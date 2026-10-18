import { Top } from '@toss/tds-mobile';

/** 공유 링크로 들어온 친구 방 (읽기 전용). TODO: 공유 링크 파라미터 → 방 데이터 로드 */
export function VisitPage() {
  return (
    <Top
      title={<Top.TitleParagraph size={22}>친구 방 구경</Top.TitleParagraph>}
      subtitleBottom={<Top.SubtitleParagraph>곧 열릴 거야</Top.SubtitleParagraph>}
    />
  );
}
