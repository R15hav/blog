"use client";
//Standard Imports
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

//Dynamic Import 
const DynamicEditorjs = dynamic(() => import('../../../components/Editorjs'), {
  ssr: false,
});

function UpdateArticlePage({ params }) {

    const [articleId, setArticleId] = useState(null);

    useEffect(() => {
        params.then((res) => {
            setArticleId(res.articleId);
        });
    }, [params]);

    return (
        <div>
            Editor Page
            <DynamicEditorjs id={ articleId }/>
        </div>
    )
}

export default UpdateArticlePage