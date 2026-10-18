import { Button, Spacing, Top } from '@toss/tds-mobile';
import { useRouter } from '@/app/router';
import { useAuth } from '@/features/auth/auth';
import { features } from '@/lib/env';

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
        {/* 방 꾸미기는 서버 연결 없이도 가능 (기기 저장). 연결 실패는 재시도만 안내 */}
        <Button display="full" size="large" loading={status === 'loading'} onClick={() => go('editor')}>
          내 방 꾸미러 가기
        </Button>
        {status === 'error' && (
          <>
            <Spacing size={8} />
            <Button display="full" size="medium" variant="weak" onClick={bootstrap}>
              서버 다시 연결하기
            </Button>
          </>
        )}
        {features.payments && (
          <>
            <Spacing size={12} />
            <Button display="full" size="large" variant="weak" onClick={() => go('shop')}>
              생성권 상점
            </Button>
          </>
        )}
      </div>
    </>
  );
}
