import type { MenuSectionType } from '../types/wedding.types';

export const MENU_DEFAULT_TITLE = 'Menu weselne';
export const MENU_DEFAULT_BLOCK_TITLE = 'Główne menu weselne';

export const MENU_SECTION_TYPE_OPTIONS: Array<{ value: MenuSectionType; label: string }> = [
    { value: 'przystawka', label: 'Przystawka' },
    { value: 'zupa', label: 'Zupy' },
    { value: 'danie_glowne', label: 'Danie główne' },
    { value: 'deser', label: 'Desery' },
    { value: 'kolacja', label: 'Kolacja' },
    { value: 'zimna_plyta', label: 'Zimna płyta' },
    { value: 'bufet', label: 'Bufet' },
    { value: 'napoje', label: 'Napoje' },
    { value: 'alkohol', label: 'Alkohol' },
    { value: 'slodki_stol', label: 'Słodki stół' },
    { value: 'inne', label: 'Inne' },
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
