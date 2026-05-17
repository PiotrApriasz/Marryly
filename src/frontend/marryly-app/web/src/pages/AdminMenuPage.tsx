import { useEffect, useRef, useState } from 'react';
import { adminClient } from '../api/adminClient';
import AdminBackLink from '../components/AdminBackLink';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Button from '../components/Button';
import Field from '../components/Field';
import IconButton from '../components/IconButton';
import Input from '../components/Input';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { invalidateAdminCache } from '../hooks/admin/useAdminApiResource';
import { useAdminMenu } from '../hooks/admin/useAdminMenu';
import { invalidateMenuCache } from '../hooks/useMenu';
import type { AdminMenu, AdminMenuPayload, AdminMenuSectionType } from '../types/admin.types';
import {
    getDefaultMenuSectionName,
    getMenuSectionTypeLabel,
    MENU_DEFAULT_BLOCK_TITLE,
    MENU_DEFAULT_TITLE,
    MENU_SECTION_TYPE_OPTIONS,
} from '../utils/menu';

interface DraftMenuItem {
    id: string;
    name: string;
    description: string;
}

interface DraftMenuSection {
    id: string;
    sectionType: AdminMenuSectionType;
    items: DraftMenuItem[];
}

interface DraftMenuBlock {
    id: string;
    title: string;
    sections: DraftMenuSection[];
}

interface DraftMenu {
    title: string;
    blocks: DraftMenuBlock[];
}

function createLocalId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return `menu-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyItem(): DraftMenuItem {
    return {
        id: createLocalId(),
        name: '',
        description: '',
    };
}

function createEmptySection(sectionType: AdminMenuSectionType = 'przystawka'): DraftMenuSection {
    return {
        id: createLocalId(),
        sectionType,
        items: [createEmptyItem()],
    };
}

function createEmptyBlock(title = MENU_DEFAULT_BLOCK_TITLE): DraftMenuBlock {
    return {
        id: createLocalId(),
        title,
        sections: [createEmptySection()],
    };
}

function createDraftFromMenu(menu: AdminMenu): DraftMenu {
    return {
        title: menu.title || MENU_DEFAULT_TITLE,
        blocks: menu.blocks.map((block) => ({
            id: createLocalId(),
            title: block.title,
            sections: block.sections.map((section) => ({
                id: createLocalId(),
                sectionType: section.sectionType,
                items: section.items.map((item) => ({
                    id: createLocalId(),
                    name: item.name,
                    description: item.description ?? '',
                })),
            })),
        })),
    };
}

export default function AdminMenuPage() {
    const { menu, loading, error, reload } = useAdminMenu();
    const [draft, setDraft] = useState<DraftMenu>({ title: MENU_DEFAULT_TITLE, blocks: [] });
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const lastHydratedSignatureRef = useRef<string | null>(null);
    const menuSignature = JSON.stringify(menu);

    useEffect(() => {
        if (loading || isDirty || lastHydratedSignatureRef.current === menuSignature) {
            return;
        }

        setDraft(createDraftFromMenu(menu));
        lastHydratedSignatureRef.current = menuSignature;
    }, [isDirty, loading, menu, menuSignature]);

    const blockCount = draft.blocks.length;
    const sectionCount = draft.blocks.reduce((total, block) => total + block.sections.length, 0);
    const itemCount = draft.blocks.reduce(
        (total, block) => total + block.sections.reduce((sectionTotal, section) => sectionTotal + section.items.length, 0),
        0
    );

    const updateDraft = (updater: (current: DraftMenu) => DraftMenu) => {
        setDraft((current) => updater(current));
        setIsDirty(true);
        setSaveError(null);
        setSaveMessage(null);
    };

    const moveBlock = (blockId: string, direction: -1 | 1) => {
        updateDraft((current) => {
            const index = current.blocks.findIndex((block) => block.id === blockId);
            const nextIndex = index + direction;
            if (index < 0 || nextIndex < 0 || nextIndex >= current.blocks.length) {
                return current;
            }

            const blocks = [...current.blocks];
            const [block] = blocks.splice(index, 1);
            blocks.splice(nextIndex, 0, block);

            return { ...current, blocks };
        });
    };

    const moveSection = (blockId: string, sectionId: string, direction: -1 | 1) => {
        updateDraft((current) => ({
            ...current,
            blocks: current.blocks.map((block) => {
                if (block.id !== blockId) {
                    return block;
                }

                const index = block.sections.findIndex((section) => section.id === sectionId);
                const nextIndex = index + direction;
                if (index < 0 || nextIndex < 0 || nextIndex >= block.sections.length) {
                    return block;
                }

                const sections = [...block.sections];
                const [section] = sections.splice(index, 1);
                sections.splice(nextIndex, 0, section);

                return {
                    ...block,
                    sections,
                };
            }),
        }));
    };

    const moveItem = (blockId: string, sectionId: string, itemId: string, direction: -1 | 1) => {
        updateDraft((current) => ({
            ...current,
            blocks: current.blocks.map((block) => {
                if (block.id !== blockId) {
                    return block;
                }

                return {
                    ...block,
                    sections: block.sections.map((section) => {
                        if (section.id !== sectionId) {
                            return section;
                        }

                        const index = section.items.findIndex((item) => item.id === itemId);
                        const nextIndex = index + direction;
                        if (index < 0 || nextIndex < 0 || nextIndex >= section.items.length) {
                            return section;
                        }

                        const items = [...section.items];
                        const [item] = items.splice(index, 1);
                        items.splice(nextIndex, 0, item);

                        return {
                            ...section,
                            items,
                        };
                    }),
                };
            }),
        }));
    };

    const handleSave = async () => {
        const payload: AdminMenuPayload = {
            title: draft.title.trim() || MENU_DEFAULT_TITLE,
            blocks: draft.blocks.map((block, blockIndex) => ({
                title: block.title.trim() || MENU_DEFAULT_BLOCK_TITLE,
                sortOrder: blockIndex,
                sections: block.sections.map((section, sectionIndex) => ({
                    sectionType: section.sectionType,
                    name: getDefaultMenuSectionName(section.sectionType),
                    choicesCount: null,
                    sortOrder: sectionIndex,
                    items: section.items.map((item, itemIndex) => ({
                        name: item.name.trim(),
                        description: item.description.trim() || null,
                        sortOrder: itemIndex,
                    })),
                })),
            })),
        };

        setIsSaving(true);
        setSaveError(null);
        setSaveMessage(null);

        try {
            const savedMenu = await adminClient.saveMenu(payload);
            setDraft(createDraftFromMenu(savedMenu));
            setIsDirty(false);
            setSaveMessage('Menu zapisane. Zmiany są już widoczne na stronie dla gości.');
            lastHydratedSignatureRef.current = JSON.stringify(savedMenu);
            invalidateAdminCache('menu');
            invalidateAdminCache('overview');
            invalidateMenuCache();
            reload();
        } catch (saveErr) {
            setSaveError(getErrorMessageForDisplay(saveErr, 'Nie udało się zapisać menu.'));
            logErrorDetails(saveErr, 'Failed to save wedding menu');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Layout>
            <AdminBackLink />
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Menu wesela"
                        helpText="Każdy blok menu może mieć własne rodzaje posiłku, np. główne menu, słodki stół albo napoje."
                        className="mb-10"
                    />

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={false}
                        emptyMessage=""
                    >
                        <div className="menu-editor-shell">
                            <div className="menu-editor-toolbar">
                                <div>
                                    <div className="menu-editor-summary">
                                        <span className="menu-editor-summary-item">
                                            <strong>{blockCount}</strong>
                                            bloków
                                        </span>
                                        <span className="menu-editor-summary-item">
                                            <strong>{sectionCount}</strong>
                                            rodzajów
                                        </span>
                                        <span className="menu-editor-summary-item">
                                            <strong>{itemCount}</strong>
                                            dań
                                        </span>
                                        <span className="menu-editor-summary-item">
                                            <strong>{isDirty ? 'Robocze zmiany' : 'Zapisane'}</strong>
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => updateDraft((current) => ({
                                            ...current,
                                            blocks: [...current.blocks, createEmptyBlock()],
                                        }))}
                                    >
                                        Dodaj blok menu
                                    </Button>
                                    <Button size="sm" onClick={handleSave} loading={isSaving}>
                                        Zapisz menu
                                    </Button>
                                </div>
                            </div>

                            {saveError && <ApiErrorAlert message={saveError} />}
                            {saveMessage && (
                                <div className="notice border-emerald-200 bg-emerald-50 text-emerald-700">
                                    <p className="notice-title">Zapisano</p>
                                    <p className="notice-body">{saveMessage}</p>
                                </div>
                            )}

                            <div className="mt-6 space-y-8">
                                {draft.blocks.map((block, blockIndex) => (
                                    <div key={block.id} className="menu-block-card">
                                        <div className="menu-section-card-header">
                                            <div>
                                                <h3 className="font-serif text-3xl text-ink">
                                                    {block.title.trim() || 'Nowy blok menu'}
                                                </h3>
                                            </div>
                                            <div className="menu-section-card-actions">
                                                <IconButton
                                                    type="button"
                                                    label="Przesuń blok wyżej"
                                                    icon="↑"
                                                    onClick={() => moveBlock(block.id, -1)}
                                                    disabled={blockIndex === 0}
                                                />
                                                <IconButton
                                                    type="button"
                                                    label="Przesuń blok niżej"
                                                    icon="↓"
                                                    onClick={() => moveBlock(block.id, 1)}
                                                    disabled={blockIndex === draft.blocks.length - 1}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => updateDraft((current) => ({
                                                        ...current,
                                                        blocks: current.blocks.filter((item) => item.id !== block.id),
                                                    }))}
                                                >
                                                    Usuń blok
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 md:max-w-xl">
                                            <Field label="Nazwa bloku menu" htmlFor={`block-title-${block.id}`} labelTone="strong">
                                                <Input
                                                    id={`block-title-${block.id}`}
                                                    value={block.title}
                                                    onChange={(event) => updateDraft((current) => ({
                                                        ...current,
                                                        blocks: current.blocks.map((item) => (
                                                            item.id === block.id
                                                                ? { ...item, title: event.target.value }
                                                                : item
                                                        )),
                                                    }))}
                                                    placeholder={MENU_DEFAULT_BLOCK_TITLE}
                                                />
                                            </Field>
                                        </div>

                                        <div className="mt-6 space-y-5">
                                            {block.sections.map((section, sectionIndex) => (
                                                <div key={section.id} className="menu-item-card">
                                                    <div className="menu-section-card-header">
                                                        <div>
                                                            <h4 className="font-serif text-2xl text-ink">
                                                                {getMenuSectionTypeLabel(section.sectionType)}
                                                            </h4>
                                                        </div>
                                                        <div className="menu-section-card-actions">
                                                            <IconButton
                                                                type="button"
                                                                label="Przesuń rodzaj wyżej"
                                                                icon="↑"
                                                                onClick={() => moveSection(block.id, section.id, -1)}
                                                                disabled={sectionIndex === 0}
                                                            />
                                                            <IconButton
                                                                type="button"
                                                                label="Przesuń rodzaj niżej"
                                                                icon="↓"
                                                                onClick={() => moveSection(block.id, section.id, 1)}
                                                                disabled={sectionIndex === block.sections.length - 1}
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => updateDraft((current) => ({
                                                                    ...current,
                                                                    blocks: current.blocks.map((currentBlock) => (
                                                                        currentBlock.id === block.id
                                                                            ? {
                                                                                ...currentBlock,
                                                                                sections: currentBlock.sections.filter((item) => item.id !== section.id),
                                                                            }
                                                                            : currentBlock
                                                                    )),
                                                                }))}
                                                            >
                                                                Usuń rodzaj
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-4 md:max-w-sm">
                                                        <Field label="Rodzaj posiłku" htmlFor={`section-type-${section.id}`} labelTone="strong">
                                                            <Select
                                                                id={`section-type-${section.id}`}
                                                                value={section.sectionType}
                                                                onChange={(event) => {
                                                                    const nextType = event.target.value as AdminMenuSectionType;
                                                                    updateDraft((current) => ({
                                                                        ...current,
                                                                        blocks: current.blocks.map((currentBlock) => (
                                                                            currentBlock.id === block.id
                                                                                ? {
                                                                                    ...currentBlock,
                                                                                    sections: currentBlock.sections.map((item) => (
                                                                                        item.id === section.id
                                                                                            ? { ...item, sectionType: nextType }
                                                                                            : item
                                                                                    )),
                                                                                }
                                                                                : currentBlock
                                                                        )),
                                                                    }));
                                                                }}
                                                            >
                                                                {MENU_SECTION_TYPE_OPTIONS.map((option) => (
                                                                    <option key={option.value} value={option.value}>
                                                                        {option.label}
                                                                    </option>
                                                                ))}
                                                            </Select>
                                                        </Field>
                                                    </div>

                                                    <div className="mt-6 space-y-4">
                                                        {section.items.map((item, itemIndex) => (
                                                            <div key={item.id} className="rounded-2xl border border-sand bg-white p-4">
                                                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                                                    <div className="font-sans text-sm font-medium text-muted">
                                                                        Danie {itemIndex + 1}
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <IconButton
                                                                            type="button"
                                                                            label="Przesuń danie wyżej"
                                                                            icon="↑"
                                                                            onClick={() => moveItem(block.id, section.id, item.id, -1)}
                                                                            disabled={itemIndex === 0}
                                                                        />
                                                                        <IconButton
                                                                            type="button"
                                                                            label="Przesuń danie niżej"
                                                                            icon="↓"
                                                                            onClick={() => moveItem(block.id, section.id, item.id, 1)}
                                                                            disabled={itemIndex === section.items.length - 1}
                                                                        />
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => updateDraft((current) => ({
                                                                                ...current,
                                                                                blocks: current.blocks.map((currentBlock) => (
                                                                                    currentBlock.id === block.id
                                                                                        ? {
                                                                                            ...currentBlock,
                                                                                            sections: currentBlock.sections.map((currentSection) => (
                                                                                                currentSection.id === section.id
                                                                                                    ? {
                                                                                                        ...currentSection,
                                                                                                        items: currentSection.items.filter((currentItem) => currentItem.id !== item.id),
                                                                                                    }
                                                                                                    : currentSection
                                                                                            )),
                                                                                        }
                                                                                        : currentBlock
                                                                                )),
                                                                            }))}
                                                                        >
                                                                            Usuń
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                <div className="grid gap-4">
                                                                    <Field label="Nazwa dania" htmlFor={`item-name-${item.id}`} labelTone="strong">
                                                                        <Input
                                                                            id={`item-name-${item.id}`}
                                                                            value={item.name}
                                                                            onChange={(event) => updateDraft((current) => ({
                                                                                ...current,
                                                                                blocks: current.blocks.map((currentBlock) => (
                                                                                    currentBlock.id === block.id
                                                                                        ? {
                                                                                            ...currentBlock,
                                                                                            sections: currentBlock.sections.map((currentSection) => (
                                                                                                currentSection.id === section.id
                                                                                                    ? {
                                                                                                        ...currentSection,
                                                                                                        items: currentSection.items.map((currentItem) => (
                                                                                                            currentItem.id === item.id
                                                                                                                ? { ...currentItem, name: event.target.value }
                                                                                                                : currentItem
                                                                                                        )),
                                                                                                    }
                                                                                                    : currentSection
                                                                                            )),
                                                                                        }
                                                                                        : currentBlock
                                                                                )),
                                                                            }))}
                                                                            placeholder="Np. Rosół królewski"
                                                                        />
                                                                    </Field>

                                                                    <Field label="Opis" htmlFor={`item-description-${item.id}`}>
                                                                        <Textarea
                                                                            id={`item-description-${item.id}`}
                                                                            rows={3}
                                                                            value={item.description}
                                                                            onChange={(event) => updateDraft((current) => ({
                                                                                ...current,
                                                                                blocks: current.blocks.map((currentBlock) => (
                                                                                    currentBlock.id === block.id
                                                                                        ? {
                                                                                            ...currentBlock,
                                                                                            sections: currentBlock.sections.map((currentSection) => (
                                                                                                currentSection.id === section.id
                                                                                                    ? {
                                                                                                        ...currentSection,
                                                                                                        items: currentSection.items.map((currentItem) => (
                                                                                                            currentItem.id === item.id
                                                                                                                ? { ...currentItem, description: event.target.value }
                                                                                                                : currentItem
                                                                                                        )),
                                                                                                    }
                                                                                                    : currentSection
                                                                                            )),
                                                                                        }
                                                                                        : currentBlock
                                                                                )),
                                                                            }))}
                                                                            placeholder="Opcjonalny opis z karty menu lub sali."
                                                                        />
                                                                    </Field>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="mt-5 flex flex-wrap gap-3">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => updateDraft((current) => ({
                                                                ...current,
                                                                blocks: current.blocks.map((currentBlock) => (
                                                                    currentBlock.id === block.id
                                                                        ? {
                                                                            ...currentBlock,
                                                                            sections: currentBlock.sections.map((item) => (
                                                                                item.id === section.id
                                                                                    ? { ...item, items: [...item.items, createEmptyItem()] }
                                                                                    : item
                                                                            )),
                                                                        }
                                                                        : currentBlock
                                                                )),
                                                            }))}
                                                        >
                                                            Dodaj danie
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-6 flex flex-wrap gap-3">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => updateDraft((current) => ({
                                                    ...current,
                                                    blocks: current.blocks.map((item) => (
                                                        item.id === block.id
                                                            ? { ...item, sections: [...item.sections, createEmptySection()] }
                                                            : item
                                                    )),
                                                }))}
                                            >
                                                Dodaj rodzaj posiłku
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {draft.blocks.length === 0 && (
                                <div className="menu-block-card mt-6 text-center">
                                    <h3 className="font-serif text-2xl text-ink">Brak bloków menu</h3>
                                    <p className="mt-3 font-sans text-sm leading-7 text-muted">
                                        Zacznij od dodania pierwszego bloku, np. głównego menu, słodkiego stołu albo napojów.
                                    </p>
                                    <Button
                                        className="mt-6"
                                        variant="secondary"
                                        onClick={() => updateDraft((current) => ({
                                            ...current,
                                            blocks: [createEmptyBlock()],
                                        }))}
                                    >
                                        Dodaj pierwszy blok
                                    </Button>
                                </div>
                            )}

                            {draft.blocks.length > 0 && (
                                <div className="mt-6 flex justify-end">
                                    <Button onClick={handleSave} loading={isSaving}>
                                        Zapisz menu
                                    </Button>
                                </div>
                            )}
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
