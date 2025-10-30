import { Eye, FileText, FileSearch } from "lucide-react";

export type PresetKey = 'md' | 'desc' | 'ground' | 'custom';

export const PRESETS = [
  { key: 'md' as const, label: '转Markdown', value: 'Free OCR, output markdown.', Icon: FileText },
  { key: 'desc' as const, label: '图片描述', value: 'Describe this image in detail.', Icon: Eye },
  { key: 'ground' as const, label: '文档深度解析', value: '<|grounding|>Convert the document to markdown.', Icon: FileSearch },
];

export function getPresetByKey(k: PresetKey) {
  return PRESETS.find(p => p.key === k) || PRESETS[0];
}
