"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from 'next/navigation';

import { getTokenFromLocalStorage, getCurrentFormattedDate } from "../_lib/utility";
import { verifyToken } from "../_lib/api_callout";

import EditorJS from "@editorjs/editorjs";
import Embed from "@editorjs/embed";
import Table from "@editorjs/table";
import List from "@editorjs/list";
import Warning from "@editorjs/warning";
import Code from "@editorjs/code";
import LinkTool from "@editorjs/link";
import Image from "@editorjs/image";
import Raw from "@editorjs/raw";
import Header from "@editorjs/header";
import Quote from "@editorjs/quote";
import Marker from "@editorjs/marker";
import CheckList from "@editorjs/checklist";
import Delimiter from "@editorjs/delimiter";
import InlineCode from "@editorjs/inline-code";
import SimpleImage from "@editorjs/simple-image";


function Editorjs({id}) {

    const router = useRouter();

    const editorInstance = useRef();
    const articleDataToUpdate= useRef();
    const loggedInownerId = useRef();
    const loggedIntoken = useRef();

    const [loading, setLoading] = useState(true);
    const [published, setPublished] = useState(true);
    const [statusMsg, setStatusMsg] = useState(null);

    async function fetchArticleData(articleId) {
        try {
            const res = await fetch(`http://localhost:8000/api/v1/get-article/${articleId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await res.json().catch(() => null);
            
            if (!res.ok) {
                setStatusMsg(`Fetch failed: ${data && (data.detail || data.error || JSON.stringify(data))}`);
                return null;
            }

            return data;
        } catch (error) {
            setStatusMsg('Fetching article failed: ' + (error && error.message ? error.message : String(error)));
            return null;
        }
    }
    
    function initEditorjs(){
        if( editorInstance.current ) {
            return;
        }
        const editor = new EditorJS({ 
            holder: 'editorjs', 
            tools: { 
                embed: Embed,
                table: Table,
                marker: Marker,
                list: List,
                warning: Warning,
                code: Code,
                linkTool: LinkTool,
                image: Image,
                raw: Raw,
                header: Header,
                quote: Quote,
                checklist: CheckList,
                delimiter: Delimiter,
                inlineCode: InlineCode,
                simpleImage: SimpleImage
            },
            data: articleDataToUpdate.current || { },

            onReady: () => {
                console.log('Editor.js is ready to work!')
            }
        });
        editorInstance.current = editor;
    }

    function editorInitSnippet() {
        const init = () => {
            initEditorjs();
        }
        if(window !== undefined){
            init();
        }
    }

    useEffect(() => {
        if (!id) return;
        const articleData = async () =>await fetchArticleData(id);
        articleData().then(data => {
            if (data) {
                console.log('retrived data', data.article[0].content);
                const content = JSON.parse(data.article[0].content);
                articleDataToUpdate.current = content;
                editorInitSnippet();
            }
        })
    }, [id]);

    useEffect(() => {
        if (id) return;
        const {owner_id, token} = getTokenFromLocalStorage();
        loggedInownerId.current = owner_id;
        loggedIntoken.current = token;
        editorInitSnippet();
    }, []);

    const save = async () => {
        if (!loggedIntoken.current) { return ;}
        setStatusMsg(null)
        try {
            const outputData = await editorInstance.current.save();
            const created_date = getCurrentFormattedDate();
            const tokenValid = await verifyToken(loggedIntoken.current);

            if (!tokenValid) {
                console.error('token not valid');
                setStatusMsg('token not valid, please login again');
                //router.push("/login");
                return;
            }
            
            const body = {
                owner_id: loggedInownerId.current || "",
                content: JSON.stringify(outputData),
                published: Boolean(published),
                created_date,
            }

            const res = await fetch('http://localhost:8000/api/v1/create-article', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${loggedIntoken.current}`,
                },
                credentials: 'include',
                body: JSON.stringify(body),
            })

            const data = await res.json().catch(() => null)
            if (!res.ok) {
                setStatusMsg(`Create failed: ${data && (data.detail || data.error || JSON.stringify(data))}`)
                return
            }

            setStatusMsg('Article created successfully')
            console.log('Create response:', data)
        } catch (error) {
            console.error('Nothing created', error);
            setStatusMsg('Saving failed: ' + (error && error.message ? error.message : String(error)))
        }
    }

    return (
        <>
            <div id="editorjs"></div>
            <button onClick={save}>Save</button>
        </>
    )
}

export default Editorjs