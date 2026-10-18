import { Button, Spacing, Top } from '@toss/tds-mobile';
import { useRouter } from '@/app/router';
import { useAuth } from '@/features/auth/tossLogin';

export function HomePage() {
  const go = useRouter((s) => s.go);
  const { me, status, login } = useAuth();

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={22}>나만의 상상력으로 꾸며지는 공간</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph>다락방에 온 걸 환영해</Top.SubtitleParagraph>}
      />
      <div style={{ padding: '0 24px' }}>
        {me ? (
          <Button display="full" size="large" onClick={() => go('editor')}>
            내 방 꾸미러 가기
          </Button>
        ) : (
          <Button display="full" size="large" loading={status === 'loading'} onClick={login}>
            토스로 시작하기
          </Button>
        )}
        {status === 'error' && <p style={{ color: '#f04452' }}>로그인이 안 됐어. 다시 해볼래?</p>}
        <Spacing size={12} />
        <Button display="full" size="large" variant="weak" onClick={() => go('shop')}>
          생성권 상점
        </Button>
      </div>
    </>
  );
}
