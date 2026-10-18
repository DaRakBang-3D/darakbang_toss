import { Device, FetchAlbumPhotosPermissionError, Storage } from '@apps-in-toss/web-framework';
import { api, ApiError } from '@/api/client';
import type { TextureSlot } from './catalog';
import { useRoom, type RoomData } from './roomStore';

/** GPU 메모리 보호: 512px면 텍스처 1장 약 1MB. 방당 3장 */
const TEXTURE_PX = 512;
const JPEG_QUALITY = 0.82;
const localKey = (slot: TextureSlot) => `darakbang.texture.${slot}`;

export type PhotoResult = 'approved' | 'local' | 'blocked' | 'cancelled' | 'denied' | 'failed';

async function pickPhoto(): Promise<string | null | 'denied'> {
  const opts = { maxCount: 1, maxWidth: 1024, base64: true };
  try {
    const [photo] = await Device.getPhotos(opts);
    return photo ? toDataUri(photo.dataUri) : null;
  } catch (e) {
    if (!(e instanceof FetchAlbumPhotosPermissionError)) throw e;
    // 권한 거부 → 한 번만 설정 안내를 띄우고 다시 시도
    const r = await Device.getPhotos.openPermissionDialog().catch(() => 'denied');
    if (r !== 'allowed') return 'denied';
    const [photo] = await Device.getPhotos(opts);
    return photo ? toDataUri(photo.dataUri) : null;
  }
}

const toDataUri = (s: string) => (s.startsWith('data:') ? s : `data:image/jpeg;base64,${s}`);

/** 정사각형으로 가운데를 잘라 512px JPEG로 축소 (반복 패턴·용량 모두 유리) */
async function shrink(dataUri: string): Promise<string> {
  const img = new Image();
  img.src = dataUri;
  await img.decode();
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(TEXTURE_PX, side);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 미지원');
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/**
 * 앨범 사진을 슬롯(벽지·바닥·패브릭)에 입힌다.
 * - 서버 검사 통과 → approved (친구에게도 보임)
 * - 부적절 판정 → blocked (적용하지 않음)
 * - 서버에 닿지 못함 → local (내 폰에서만 보임, 공유 화면에선 기본 재질)
 */
export async function applyPhoto(slot: TextureSlot): Promise<PhotoResult> {
  let picked: string | null | 'denied';
  try {
    picked = await pickPhoto();
  } catch (e) {
    console.warn('[photo] 앨범 열기 실패', e);
    return 'failed';
  }
  if (picked === 'denied') return 'denied';
  if (!picked) return 'cancelled';

  const jpeg = await shrink(picked);
  const { setTexture } = useRoom.getState();
  try {
    const r = await api<{ id: string; url: string }>('/textures', {
      method: 'POST',
      json: { slot, image: jpeg.slice(jpeg.indexOf(',') + 1) },
    });
    await Storage.removeItem(localKey(slot)).catch(() => {
      /* 남아 있어도 approved가 우선이라 무해 */
    });
    setTexture(slot, { id: r.id, status: 'approved' }, r.url);
    return 'approved';
  } catch (e) {
    if (e instanceof ApiError && e.code === 'inappropriate_image') return 'blocked';
    // 검사 서버 미연결: 본인 기기에서만 쓰는 사진으로 허용
    await Storage.setItem(localKey(slot), jpeg);
    setTexture(slot, { id: `local-${slot}`, status: 'local' }, jpeg);
    return 'local';
  }
}

export async function removePhoto(slot: TextureSlot) {
  useRoom.getState().setTexture(slot, null);
  await Storage.removeItem(localKey(slot)).catch(() => {
    /* 지울 게 없으면 그만 */
  });
}

/** 불러온 방의 사진 참조를 실제 이미지 주소로 바꿔 스토어에 채운다 */
export async function resolvePhotos(textures: RoomData['textures']) {
  const { setTexture } = useRoom.getState();
  for (const [slot, ref] of Object.entries(textures) as [
    TextureSlot,
    NonNullable<RoomData['textures'][TextureSlot]>,
  ][]) {
    try {
      const src =
        ref.status === 'local'
          ? await Storage.getItem(localKey(slot))
          : (await api<{ url: string }>(`/textures/${ref.id}`)).url;
      if (src) setTexture(slot, ref, src);
    } catch {
      /* 이미지를 못 가져오면 기본 재질로 보임 */
    }
  }
  useRoom.setState({ dirty: false });
}
