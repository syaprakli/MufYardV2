import { Editor } from "@tinymce/tinymce-react";
import "tinymce/tinymce";
import "tinymce/icons/default";
import "tinymce/models/dom";
import "tinymce/themes/silver";
import "tinymce/plugins/advlist";
import "tinymce/plugins/autolink";
import "tinymce/plugins/lists";
import "tinymce/plugins/link";
import "tinymce/plugins/image";
import "tinymce/plugins/charmap";
import "tinymce/plugins/anchor";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/code";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/insertdatetime";
import "tinymce/plugins/media";
import "tinymce/plugins/table";
import "tinymce/plugins/preview";

import "tinymce/plugins/wordcount";
import "tinymce/plugins/quickbars";
import "tinymce/skins/ui/oxide/skin.css";
import "tinymce/skins/content/default/content.css";

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
