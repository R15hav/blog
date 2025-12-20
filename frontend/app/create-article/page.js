"use client";
//Standard Imports
import dynamic from 'next/dynamic';

//Dynamic Import 
const DynamicEditorjs = dynamic(() => import('../components/Editorjs'), {
  ssr: false,
});

function page() {
  return (
    <div>
        Editor Page
        <DynamicEditorjs />
    </div>
  )
}

export default page