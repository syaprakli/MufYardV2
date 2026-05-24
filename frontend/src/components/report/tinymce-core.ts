import tinymce from 'tinymce/tinymce';

// Explicitly bind tinymce to the window object for plugins
if (typeof window !== 'undefined') {
  (window as any).tinymce = tinymce;
}

export default tinymce;
