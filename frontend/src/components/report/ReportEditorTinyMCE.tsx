import { Editor } from "@tinymce/tinymce-react";

type TinyMCEProps = {
    licenseKey: string;
    value: string;
    disabled?: boolean;
    onInit: (evt: any, editor: any) => void;
    onEditorChange: (content: string) => void;
    init: Record<string, any>;
};

export default function ReportEditorTinyMCE(props: TinyMCEProps) {
    return <Editor {...props} />;
}
