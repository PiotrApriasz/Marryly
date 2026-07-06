import { appText } from '../content/appText';
import type { MenuSectionType } from '../types/wedding.types';

export const MENU_DEFAULT_TITLE = appText.public.menu.title;
export const MENU_DEFAULT_BLOCK_TITLE = appText.menu.defaultBlockTitle;

export const MENU_SECTION_TYPE_OPTIONS: Array<{ value: MenuSectionType; label: string }> = [
    { value: 'przystawka', label: appText.menu.sectionTypes.przystawka },
    { value: 'zupa', label: 'Zupy' },
    { value: 'danie_glowne', label: appText.menu.sectionTypes.danie_glowne },
    { value: 'deser', label: 'Desery' },
    { value: 'kolacja', label: 'Kolacja' },
    { value: 'zimna_plyta', label: appText.menu.sectionTypes.zimna_plyta },
    { value: 'bufet', label: 'Bufet' },
    { value: 'napoje', label: appText.menu.sectionTypes.napoje },
    { value: 'alkohol', label: 'Alkohol' },
    { value: 'slodki_stol', label: appText.menu.sectionTypes.slodki_stol },
    { value: 'inne', label: appText.menu.sectionTypes.inne },
];

const SECTION_TYPE_LABELS: Record<MenuSectionType, string> = Object.fromEntries(
    MENU_SECTION_TYPE_OPTIONS.map((option) => [option.value, option.label])
) as Record<MenuSectionType, string>;

export function getMenuSectionTypeLabel(sectionType: MenuSectionType): string {
    return SECTION_TYPE_LABELS[sectionType] ?? SECTION_TYPE_LABELS.inne;
}

export function getDefaultMenuSectionName(sectionType: MenuSectionType): string {
    return getMenuSectionTypeLabel(sectionType);
}
