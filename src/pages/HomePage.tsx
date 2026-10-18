import { Button, Spacing, Top } from '@toss/tds-mobile';
import { useRouter } from '@/app/router';
import { useAuth } from '@/features/auth/auth';

/** 로그인 버튼 없음: 진입하는 순간 식별키로 준회원 생성 → 바로 꾸미기 */
export function HomePage() {
  const go = useRouter((s) => s.go);
  const { status, bootstrap } = useAuth();

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>나만의 상상력으로 꾸며지는 공간</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph>다락방에 온 걸 환영해</Top.SubtitleParagraph>}
      />
      <div style={{ padding: '0 24px' }}>
        {status === 'error' ? (
          <Button display="full" size="large" onClick={bootstrap}>
            다시 연결하기
          </Button>
        ) : (
          <Button display="full" size="large" loading={status !== 'ready'} onClick={() => go('editor')}>
            내 방 꾸미러 가기
          </Button>
        )}
        <Spacing size={12} />
        <Button display="full" size="large" variant="weak" onClick={() => go('shop')}>
          생성권 상점
        </Button>
      </div>
    </>
  );
}
