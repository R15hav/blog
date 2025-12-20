"use client";
//Standard Imports
import dynamic from 'next/dynamic';

//Component Imports
//import Editorjs from "../components/Editorjs";

//preinitialize Editorjs as a dynamic import to prevent SSR issues
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