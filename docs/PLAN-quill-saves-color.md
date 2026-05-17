# PLAN - Quill Color & Vurgu Formatting and Robust Persistence

This plan outlines the systematic resolution of formatting and saving issues in the MufYardV2 Report Editor.

---

## 🔍 Debug Analysis & Root Cause

### 1. Metin Rengi ve Vurgu (Color & Background Highlight) Sorunu
* **Symptom:** Text color and highlight formatting are not applied when selected from the toolbar.
* **Root Cause:** By default, Quill uses CSS classes (e.g., `ql-color-red`) to apply colors. Since we do not have predefined classes for every hex color in our CSS, the formats are ignored by the browser.
* **Solution:** Register style-based attributors in Quill for `color` and `background`. This forces Quill to apply inline styles (e.g., `style="color: #ff0000;"` and `style="background-color: #ffff00;"`), which work natively and immediately in all browsers.

### 2. Kaydetme Hatası (Report Content Persistence) Sorunu
* **Symptom:** Pressing "Kaydet" and exiting does not persist changes.
* **Root Cause:** ReactQuill is memoized to prevent cursor jumping, which is correct when paired with Yjs. However, this causes the React state `content` to become stale. When `handleSave` is called, it saves the stale React state `content` instead of the actual content inside the Quill editor, causing changes to be lost.
* **Solution:** Update `handleSave` to read the HTML directly from the Quill editor instance (`quillRef.current.getEditor().root.innerHTML`) at the moment of saving.
* **Bonus Premium Feature:** Add an automatic auto-save interval every 30 seconds to guarantee no data is ever lost.

---

## 🛠️ Detailed Tasks & Implementation Steps

### Phase 1: Style Attributor Registration
* [x] Import `attributors/style/color` and `attributors/style/background` in `ReportEditor.tsx`.
* [x] Register them with `Quill.register(..., true)`.

### Phase 2: Direct Editor Content Persistence
* [x] Refactor `handleSave` to read the absolute latest HTML using `quillRef.current.getEditor().root.innerHTML`.
* [x] Update local state `content` to match the saved value.

### Phase 3: Premium Auto-Save Integration
* [x] Add a 30-second `useEffect` auto-save interval that checks if the current editor innerHTML differs from the last saved state and updates Firestore silently.

---

## 🏁 Verification Checklist

- [ ] Select text and apply custom text color. Verify color changes instantly in the editor.
- [ ] Select text and apply highlight background color. Verify highlight changes instantly.
- [ ] Make edits, click "Kaydet", and verify success toast.
- [ ] Reload the page or navigate away and back. Verify changes are perfectly preserved.
- [ ] Check console for zero errors.
