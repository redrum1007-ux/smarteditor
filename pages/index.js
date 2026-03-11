import dynamic from 'next/dynamic';
import Head from 'next/head';

// SSR 기능을 끄고 브라우저에서만 로드하도록 설정 (Fabric.js 에러 방어!)
const SmartEditor = dynamic(() => import('../components/SmartEditor'), {
  ssr: false,
  loading: () => <div className="h-screen w-full flex items-center justify-center text-xl font-bold text-gray-500 bg-gray-50">에디터 로딩 중... 🐟</div>
});

export default function Home() {
  return (
    <>
      <Head>
        <title>코다리 스마트스토어 에디터</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main>
        <SmartEditor />
      </main>
    </>
  );
}
