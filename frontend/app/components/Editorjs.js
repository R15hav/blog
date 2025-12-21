"use client";

import { useEffect, useState, useRef } from "react";
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


function Editorjs() {
    const [loading, setLoading] = useState(true);
    const editorInstance = useRef();
    const [title, setTitle] = useState("");
    const [published, setPublished] = useState(true);
    const [statusMsg, setStatusMsg] = useState(null);

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
            }
        });
        editorInstance.current = editor;
    }

    useEffect(() => {
        const init = () => {
            initEditorjs();
        }
        if(window !== undefined){
            init();
        }
    }, []);

    const save = async () => {
        setStatusMsg(null)
        try {
            const outputData = await editorInstance.current.save()

            // infer owner_id from localStorage or JWT payload if available
            let owner_id = null
            let token = null
            try {
                owner_id = localStorage.getItem('user_id')
            } catch (e) {}

            if (!owner_id) {
                try {
                    token = localStorage.getItem('access_token')
                    if (!token) {
                        setStatusMsg('No access token found. Please login first.')
                        return
                    }
                    else {
                        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
                        owner_id = payload.sub || payload.user_id || payload.id || null
                    }
                } catch (e) {
                    // ignore
                }
            }

            const pad = (n) => String(n).padStart(2, '0')
            const d = new Date()
            const created_date = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

            const body = {
                owner_id: owner_id || "",
                title: title || "",
                content: JSON.stringify(outputData),
                published: Boolean(published),
                created_date,
            }

            const res = await fetch('http://localhost:8000/api/v1/create-article', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
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