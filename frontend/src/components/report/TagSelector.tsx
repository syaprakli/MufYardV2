import { useState } from "react";
import { Plus } from "lucide-react";

const TAG_OPTIONS = [
  { value: "temizlik", label: "Temizlik" },
  { value: "fiyat", label: "Fiyat" },
  { value: "ulaşım", label: "Ulaşım" },
  { value: "yemek", label: "Yemek" },
  { value: "personel", label: "Personel" },
  { value: "konum", label: "Konum" },
  { value: "güvenlik", label: "Güvenlik" },
];

export type TagType = string;

export function TagSelector({ value, onChange }: {
  value: TagType[];
  onChange: (tags: TagType[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = (tag: TagType) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(input);
    }
  };

  const removeTag = (tag: TagType) => {
    onChange(value.filter(t => t !== tag));
  };

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto py-1">
        {value.map(tag => (
          <span key={tag} className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full text-xs whitespace-nowrap flex items-center gap-1">
            {TAG_OPTIONS.find(t => t.value === tag)?.label || tag}
            <button type="button" onClick={() => removeTag(tag)} className="ml-1 text-violet-500 hover:text-red-500">×</button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {TAG_OPTIONS.filter(t => !value.includes(t.value)).map(tag => (
          <button
            key={tag.value}
            type="button"
            onClick={() => addTag(tag.value)}
            className="bg-slate-200 hover:bg-violet-200 text-slate-700 px-2 py-0.5 rounded-full text-xs"
          >
            {tag.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-3 items-center">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Özel etiket yazın..." 
          className="flex-1 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button 
          type="button" 
          onClick={() => addTag(input)}
          disabled={!input.trim()}
          className="h-8 px-3 bg-violet-100 text-violet-700 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1"
        >
          <Plus size={14} /> Ekle
        </button>
      </div>
    </div>
  );
}
