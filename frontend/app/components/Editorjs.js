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

    const save = () => {
        editorInstance.current.save().then((outputData) => {
            console.log('Article data: ', outputData)
        }).catch((error) => {
            console.log('Saving failed: ', error)
        });
    }

    return (
        <>
            <div id="editorjs"></div>
            <button onClick={save}>Save</button>
        </>
    )
}

export default Editorjs