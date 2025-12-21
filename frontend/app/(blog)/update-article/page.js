"use client";
//Standard Imports
import dynamic from 'next/dynamic';

//Dynamic Import 
const DynamicEditorjs = dynamic(() => import('../../components/Editorjs'), {
  ssr: false,
});

function page() {
    const id = 'fd9a5ca7-39b7-4b23-8f39-2f255797d124';
    return (
        <div>
            Editor Page
            <DynamicEditorjs id={id}/>
        </div>
    )
}

export default page