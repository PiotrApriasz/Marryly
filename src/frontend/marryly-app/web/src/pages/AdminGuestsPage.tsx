import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { adminClient } from '../api/adminClient';
import AdminBackLink from '../components/AdminBackLink';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Button from '../components/Button';
import Card from '../components/Card';
import Checkbox from '../components/Checkbox';
import Drawer from '../components/Drawer';
import Field from '../components/Field';
import IconButton from '../components/IconButton';
import Input from '../components/Input';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import Select from '../components/Select';
import StatusBadge from '../components/StatusBadge';
import Textarea from '../components/Textarea';
import { appText } from '../content/appText';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { invalidateAdminCache } from '../hooks/admin/useAdminApiResource';
import { useAdminGuests } from '../hooks/admin/useAdminGuests';
import type {
    AdminGuestInvitationGroup,
    AdminGuestListEntry,
    AdminGuestListEntryPayload,
    AdminGuestListResponse,
    GuestAttendanceStatus,
    GuestCategory,
    GuestRelationshipToGroup,
} from '../types/admin.types';

const CATEGORY_OPTIONS: Array<{ value: GuestCategory; label: string }> = [
    { value: 'adult', label: appText.admin.guests.ageGroups.adult },
    { value: 'child_3_10', label: appText.admin.guests.ageGroups.child3To10 },
    { value: 'child_over_10', label: appText.admin.guests.ageGroups.childOver10 },
    { value: 'child_under_3', label: appText.admin.guests.ageGroups.childUnder3 },
    { value: 'vendor', label: appText.admin.guests.ageGroups.vendor },
];

const ATTENDANCE_OPTIONS: Array<{ value: GuestAttendanceStatus; label: string }> = [
    { value: 'pending', label: appText.admin.guests.attendanceOptions.pending },
    { value: 'confirmed', label: appText.admin.guests.attendanceOptions.confirmed },
    { value: 'declined', label: appText.admin.guests.attendanceOptions.declined },
];

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface GuestFormState {
    fullName: string;
    category: GuestCategory;
    attendanceStatus: GuestAttendanceStatus;
    invitationGroupId: string;
    invitationGroupName: string;
    relationshipToGroup: GuestRelationshipToGroup | '';
    needsAccommodation: boolean;
    hotelName: string;
    roomNameOrNumber: string;
    needsTransport: boolean;
    transportNotes: string;
    notes: string;
}

interface FamilyChildFormState {
    id: string;
    fullName: string;
    category: Extract<GuestCategory, 'child_3_10' | 'child_over_10' | 'child_under_3'>;
}

interface FamilyFormState {
    displayName: string;
    primaryName: string;
    partnerName: string;
    attendanceStatus: GuestAttendanceStatus;
    needsAccommodation: boolean;
    hotelName: string;
    roomNameOrNumber: string;
    needsTransport: boolean;
    transportNotes: string;
    children: FamilyChildFormState[];
}

interface AccommodationDraft {
    guest: AdminGuestListEntry;
    hotelName: string;
    roomNameOrNumber: string;
}

interface TransportDraft {
    guest: AdminGuestListEntry;
    transportNotes: string;
}

const EMPTY_FORM: GuestFormState = {
    fullName: '',
    category: 'adult',
    attendanceStatus: 'pending',
    invitationGroupId: '',
    invitationGroupName: '',
    relationshipToGroup: '',
    needsAccommodation: false,
    hotelName: '',
    roomNameOrNumber: '',
    needsTransport: false,
    transportNotes: '',
    notes: '',
};

const EMPTY_FAMILY_FORM: FamilyFormState = {
    displayName: '',
    primaryName: '',
    partnerName: '',
    attendanceStatus: 'pending',
    needsAccommodation: false,
    hotelName: '',
    roomNameOrNumber: '',
    needsTransport: false,
    transportNotes: '',
    children: [],
};

function GuestsSkeleton() {
    return (
        <div className="mt-12 grid gap-4 animate-pulse">
            {[1, 2, 3, 4].map((item) => (
                <Card key={item}>
                    <div className="h-6 w-52 rounded bg-sand" />
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <div className="h-4 rounded bg-sand/70" />
                        <div className="h-4 rounded bg-sand/70" />
                        <div className="h-4 rounded bg-sand/70" />
                        <div className="h-4 rounded bg-sand/70" />
                    </div>
                </Card>
            ))}
        </div>
    );
}

function getCategoryLabel(category: GuestCategory): string {
    return CATEGORY_OPTIONS.find((item) => item.value === category)?.label ?? category;
}

function getAttendanceMetadata(status: GuestAttendanceStatus): { label: string; tone: BadgeTone } {
    switch (status) {
        case 'confirmed':
            return { label: appText.admin.guests.attendanceOptions.confirmed, tone: 'success' };
        case 'declined':
            return { label: appText.admin.guests.attendanceOptions.declined, tone: 'danger' };
        case 'pending':
        default:
            return { label: appText.admin.guests.attendanceOptions.pending, tone: 'warning' };
    }
}

function isGuestConfirmed(guest: AdminGuestListEntry): boolean {
    return guest.category === 'vendor' || guest.attendanceStatus === 'confirmed';
}

function getGuestBlockSortRank(guests: AdminGuestListEntry[]): number {
    return guests.some((guest) => guest.category === 'vendor') ? 0 : 1;
}

function PencilIcon() {
    return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 20h9" strokeLinecap="round" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16" strokeLinecap="round" />
            <path d="M10 11v6M14 11v6" strokeLinecap="round" />
            <path d="M6 7l1 14h10l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function createFormState(guest?: AdminGuestListEntry): GuestFormState {
    if (!guest) {
        return EMPTY_FORM;
    }

    return {
        fullName: guest.fullName,
        category: guest.category,
        attendanceStatus: guest.attendanceStatus,
        invitationGroupId: guest.invitationGroupId ?? '',
        invitationGroupName: guest.invitationGroupName ?? '',
        relationshipToGroup: guest.relationshipToGroup ?? '',
        needsAccommodation: guest.needsAccommodation,
        hotelName: guest.hotelName ?? '',
        roomNameOrNumber: guest.roomNameOrNumber ?? '',
        needsTransport: guest.needsTransport,
        transportNotes: guest.transportNotes ?? '',
        notes: guest.notes ?? '',
    };
}

function createPayload(form: GuestFormState): AdminGuestListEntryPayload {
    return {
        fullName: form.fullName.trim(),
        category: form.category,
        attendanceStatus: form.category === 'vendor' ? 'confirmed' : form.attendanceStatus,
        invitationGroupId: form.invitationGroupId,
        invitationGroupName: form.invitationGroupName,
        relationshipToGroup: form.relationshipToGroup || undefined,
        needsAccommodation: form.needsAccommodation,
        hotelName: form.needsAccommodation ? form.hotelName.trim() : '',
        roomNameOrNumber: form.needsAccommodation ? form.roomNameOrNumber.trim() : '',
        needsTransport: form.needsTransport,
        transportNotes: form.needsTransport ? form.transportNotes.trim() : '',
        notes: form.notes.trim(),
    };
}

function createFamilyPayload(form: FamilyFormState) {
    const members = [
        {
            fullName: form.primaryName.trim(),
            category: 'adult' as const,
            attendanceStatus: form.attendanceStatus,
            relationshipToGroup: 'primary' as const,
        },
        ...(form.partnerName.trim().length > 0
            ? [{
                fullName: form.partnerName.trim(),
                category: 'adult' as const,
                attendanceStatus: form.attendanceStatus,
                relationshipToGroup: 'partner' as const,
            }]
            : []),
        ...form.children
            .filter((child) => child.fullName.trim().length > 0)
            .map((child) => ({
                fullName: child.fullName.trim(),
                category: child.category,
                attendanceStatus: form.attendanceStatus,
                relationshipToGroup: 'child' as const,
            })),
    ].map((member) => ({
        ...member,
        needsAccommodation: form.needsAccommodation,
        hotelName: form.needsAccommodation ? form.hotelName.trim() : '',
        roomNameOrNumber: form.needsAccommodation ? form.roomNameOrNumber.trim() : '',
        needsTransport: form.needsTransport,
        transportNotes: form.needsTransport ? form.transportNotes.trim() : '',
    }));

    return {
        displayName: form.displayName.trim(),
        invitationLabel: form.displayName.trim(),
        members,
    };
}

function GuestForm({
    form,
    setForm,
    saving,
    primarySubmitLabel,
    secondarySubmitLabel,
    onPrimarySubmit,
    onSecondarySubmit,
    onCancel,
    notesMode = 'always',
    groups = [],
}: {
    form: GuestFormState;
    setForm: (nextForm: GuestFormState) => void;
    saving: boolean;
    primarySubmitLabel: string;
    secondarySubmitLabel?: string;
    onPrimarySubmit: () => void;
    onSecondarySubmit?: () => void;
    onCancel?: () => void;
    notesMode?: 'always' | 'toggle';
    groups?: AdminGuestInvitationGroup[];
}) {
    const isVendor = form.category === 'vendor';
    const [showNotes, setShowNotes] = useState(notesMode === 'always' || form.notes.trim().length > 0);
    const fieldIdSuffix = primarySubmitLabel.replace(/\s+/g, '-').toLowerCase();

    const updateForm = <K extends keyof GuestFormState>(key: K, value: GuestFormState[K]) => {
        const nextForm = { ...form, [key]: value };
        if (key === 'category' && value === 'vendor') {
            nextForm.attendanceStatus = 'confirmed';
        }
        setForm(nextForm);
    };

    const handleGroupChange = (groupId: string) => {
        const group = groups.find((item) => item.id === groupId);
        setForm({
            ...form,
            invitationGroupId: group?.id ?? '',
            invitationGroupName: group?.displayName ?? '',
            relationshipToGroup: group ? (form.relationshipToGroup || 'other') : '',
        });
    };

    return (
        <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
                <Field label={appText.admin.guests.forms.name} htmlFor={`guest-name-${fieldIdSuffix}`}>
                    <Input
                        id={`guest-name-${fieldIdSuffix}`}
                        value={form.fullName}
                        onChange={(event) => updateForm('fullName', event.target.value)}
                        placeholder={appText.admin.guests.forms.namePlaceholder}
                    />
                </Field>
                <Field label={appText.admin.guests.forms.category} htmlFor={`guest-category-${fieldIdSuffix}`}>
                    <Select
                        id={`guest-category-${fieldIdSuffix}`}
                        value={form.category}
                        onChange={(event) => updateForm('category', event.target.value as GuestCategory)}
                    >
                        {CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Select>
                </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Field label={appText.admin.guests.attendance} htmlFor={`guest-attendance-${fieldIdSuffix}`}>
                    <Select
                        id={`guest-attendance-${fieldIdSuffix}`}
                        value={isVendor ? 'confirmed' : form.attendanceStatus}
                        disabled={isVendor}
                        onChange={(event) => updateForm('attendanceStatus', event.target.value as GuestAttendanceStatus)}
                    >
                        {ATTENDANCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Select>
                </Field>
                <div className="md:pt-7">
                    <Checkbox
                        label={appText.admin.guests.forms.needsAccommodation}
                        checked={form.needsAccommodation}
                        onChange={(event) => updateForm('needsAccommodation', event.target.checked)}
                    />
                </div>
            </div>

            {groups.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label={appText.admin.guests.forms.invitationGroup} htmlFor={`guest-group-${fieldIdSuffix}`}>
                        <Select
                            id={`guest-group-${fieldIdSuffix}`}
                            value={form.invitationGroupId}
                            onChange={(event) => handleGroupChange(event.target.value)}
                        >
                            <option value="">{appText.admin.guests.forms.noGroup}</option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>{group.displayName}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label={appText.admin.guests.forms.relationshipInGroup} htmlFor={`guest-relationship-${fieldIdSuffix}`}>
                        <Select
                            id={`guest-relationship-${fieldIdSuffix}`}
                            value={form.relationshipToGroup}
                            disabled={!form.invitationGroupId}
                            onChange={(event) => updateForm('relationshipToGroup', event.target.value as GuestFormState['relationshipToGroup'])}
                        >
                            <option value="">{appText.admin.guests.forms.noValue}</option>
                            <option value="primary">{appText.admin.guests.forms.primaryPerson}</option>
                            <option value="partner">{appText.admin.guests.forms.partner}</option>
                            <option value="child">{appText.admin.guests.forms.child}</option>
                            <option value="other">{appText.admin.guests.forms.otherPerson}</option>
                        </Select>
                    </Field>
                </div>
            ) : null}

            {form.needsAccommodation ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label={appText.admin.guests.forms.hotel} htmlFor={`guest-hotel-${fieldIdSuffix}`}>
                        <Input
                            id={`guest-hotel-${fieldIdSuffix}`}
                            value={form.hotelName}
                            onChange={(event) => updateForm('hotelName', event.target.value)}
                            placeholder={appText.admin.guests.forms.hotelPlaceholder}
                        />
                    </Field>
                    <Field label={appText.admin.guests.forms.room} htmlFor={`guest-room-${fieldIdSuffix}`}>
                        <Input
                            id={`guest-room-${fieldIdSuffix}`}
                            value={form.roomNameOrNumber}
                            onChange={(event) => updateForm('roomNameOrNumber', event.target.value)}
                            placeholder={appText.admin.guests.forms.roomPlaceholder}
                        />
                    </Field>
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <Checkbox
                        label={appText.admin.guests.forms.needsTransport}
                        checked={form.needsTransport}
                        onChange={(event) => updateForm('needsTransport', event.target.checked)}
                    />
                </div>
                {form.needsTransport ? (
                    <Field label={appText.admin.guests.forms.transport} htmlFor={`guest-transport-${fieldIdSuffix}`}>
                        <Input
                            id={`guest-transport-${fieldIdSuffix}`}
                            value={form.transportNotes}
                            onChange={(event) => updateForm('transportNotes', event.target.value)}
                            placeholder={appText.admin.guests.forms.transportNotesPlaceholder}
                        />
                    </Field>
                ) : null}
            </div>

            {showNotes ? (
                <Field label={appText.admin.guests.forms.note} htmlFor={`guest-notes-${fieldIdSuffix}`}>
                    <Textarea
                        id={`guest-notes-${fieldIdSuffix}`}
                        rows={3}
                        value={form.notes}
                        onChange={(event) => updateForm('notes', event.target.value)}
                        placeholder={appText.admin.guests.forms.notePlaceholder}
                    />
                </Field>
            ) : (
                <div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowNotes(true)}>
                        {appText.admin.guests.forms.addNote}
                    </Button>
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <Button
                    type="button"
                    variant="primary"
                    loading={saving}
                    disabled={form.fullName.trim().length === 0}
                    onClick={onPrimarySubmit}
                >
                    {primarySubmitLabel}
                </Button>
                {secondarySubmitLabel && onSecondarySubmit ? (
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={saving || form.fullName.trim().length === 0}
                        onClick={onSecondarySubmit}
                    >
                        {secondarySubmitLabel}
                    </Button>
                ) : null}
                {onCancel ? (
                    <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
                        Anuluj
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

function FamilyForm({
    form,
    setForm,
    saving,
    onSubmit,
    onCancel,
}: {
    form: FamilyFormState;
    setForm: (nextForm: FamilyFormState) => void;
    saving: boolean;
    onSubmit: () => void;
    onCancel: () => void;
}) {
    const updateForm = <K extends keyof FamilyFormState>(key: K, value: FamilyFormState[K]) => {
        setForm({ ...form, [key]: value });
    };

    const updateChild = (childId: string, patch: Partial<FamilyChildFormState>) => {
        setForm({
            ...form,
            children: form.children.map((child) => child.id === childId ? { ...child, ...patch } : child),
        });
    };

    const addChild = () => {
        setForm({
            ...form,
            children: [
                ...form.children,
                {
                    id: crypto.randomUUID(),
                    fullName: '',
                    category: 'child_3_10',
                },
            ],
        });
    };

    const removeChild = (childId: string) => {
        setForm({
            ...form,
            children: form.children.filter((child) => child.id !== childId),
        });
    };

    const validMembersCount =
        (form.primaryName.trim().length > 0 ? 1 : 0) +
        (form.partnerName.trim().length > 0 ? 1 : 0) +
        form.children.filter((child) => child.fullName.trim().length > 0).length;

    return (
        <div className="grid gap-5">
            <Field label={appText.admin.guests.forms.groupName} htmlFor="family-display-name">
                <Input
                    id="family-display-name"
                    value={form.displayName}
                    onChange={(event) => updateForm('displayName', event.target.value)}
                    placeholder={appText.admin.guests.forms.familyNamePlaceholder}
                />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
                <Field label={appText.admin.guests.forms.personOne} htmlFor="family-primary-name">
                    <Input
                        id="family-primary-name"
                        value={form.primaryName}
                        onChange={(event) => updateForm('primaryName', event.target.value)}
                        placeholder={appText.admin.guests.forms.namePlaceholder}
                    />
                </Field>
                <Field label={appText.admin.guests.forms.personTwo} htmlFor="family-partner-name">
                    <Input
                        id="family-partner-name"
                        value={form.partnerName}
                        onChange={(event) => updateForm('partnerName', event.target.value)}
                        placeholder={appText.admin.guests.forms.partnerNamePlaceholder}
                    />
                </Field>
            </div>

            <div className="rounded-2xl border border-sand p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-serif text-xl text-ink">{appText.admin.guests.forms.childrenTitle}</h3>
                    <Button type="button" variant="secondary" size="sm" onClick={addChild}>
                        {appText.admin.guests.forms.addChild}
                    </Button>
                </div>

                {form.children.length === 0 ? (
                    <p className="mt-3 font-sans text-sm text-muted">{appText.admin.guests.forms.noChildren}</p>
                ) : (
                    <div className="mt-4 grid gap-3">
                        {form.children.map((child) => (
                            <div key={child.id} className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
                                <Field label={appText.admin.guests.forms.name} htmlFor={`family-child-name-${child.id}`}>
                                    <Input
                                        id={`family-child-name-${child.id}`}
                                        value={child.fullName}
                                        onChange={(event) => updateChild(child.id, { fullName: event.target.value })}
                                        placeholder={appText.admin.guests.forms.childNamePlaceholder}
                                    />
                                </Field>
                                <Field label={appText.admin.guests.forms.age} htmlFor={`family-child-category-${child.id}`}>
                                    <Select
                                        id={`family-child-category-${child.id}`}
                                        value={child.category}
                                        onChange={(event) => updateChild(child.id, { category: event.target.value as FamilyChildFormState['category'] })}
                                    >
                                        <option value="child_3_10">{appText.admin.guests.forms.child3To10}</option>
                                        <option value="child_over_10">{appText.admin.guests.forms.childOver10}</option>
                                        <option value="child_under_3">Do 3 lat</option>
                                    </Select>
                                </Field>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeChild(child.id)}>
                                    {appText.common.actions.delete}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Field label={appText.admin.guests.forms.defaultAttendance} htmlFor="family-attendance">
                    <Select
                        id="family-attendance"
                        value={form.attendanceStatus}
                        onChange={(event) => updateForm('attendanceStatus', event.target.value as GuestAttendanceStatus)}
                    >
                        {ATTENDANCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </Select>
                </Field>
                <div className="md:pt-7">
                    <Checkbox
                        label="Grupa potrzebuje noclegu"
                        checked={form.needsAccommodation}
                        onChange={(event) => updateForm('needsAccommodation', event.target.checked)}
                    />
                </div>
            </div>

            {form.needsAccommodation ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label={appText.admin.guests.forms.hotel} htmlFor="family-hotel">
                        <Input
                            id="family-hotel"
                            value={form.hotelName}
                            onChange={(event) => updateForm('hotelName', event.target.value)}
                            placeholder="Np. Willa Poprad"
                        />
                    </Field>
                    <Field label={appText.admin.guests.forms.room} htmlFor="family-room">
                        <Input
                            id="family-room"
                            value={form.roomNameOrNumber}
                            onChange={(event) => updateForm('roomNameOrNumber', event.target.value)}
                            placeholder="Np. rodzinny / do ustalenia"
                        />
                    </Field>
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <Checkbox
                        label="Grupa potrzebuje transportu"
                        checked={form.needsTransport}
                        onChange={(event) => updateForm('needsTransport', event.target.checked)}
                    />
                </div>
                {form.needsTransport ? (
                    <Field label={appText.admin.guests.forms.transport} htmlFor="family-transport">
                        <Input
                            id="family-transport"
                            value={form.transportNotes}
                            onChange={(event) => updateForm('transportNotes', event.target.value)}
                            placeholder={appText.admin.guests.forms.transportNotesPlaceholder}
                        />
                    </Field>
                ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
                <Button
                    type="button"
                    variant="primary"
                    loading={saving}
                    disabled={form.displayName.trim().length === 0 || validMembersCount === 0}
                    onClick={onSubmit}
                >
                    {appText.admin.guests.addGroup}
                </Button>
                <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
                    Anuluj
                </Button>
            </div>
        </div>
    );
}

export default function AdminGuestsPage() {
    const { guestList, loading, error } = useAdminGuests();
    const [localGuestList, setLocalGuestList] = useState<AdminGuestListResponse | null>(null);
    const tableShellRef = useRef<HTMLDivElement | null>(null);
    const actionsRef = useRef<HTMLDivElement | null>(null);
    const [floatingActionsStyle, setFloatingActionsStyle] = useState<CSSProperties | undefined>(undefined);
    const [createForm, setCreateForm] = useState<GuestFormState>(EMPTY_FORM);
    const [familyForm, setFamilyForm] = useState<FamilyFormState>(EMPTY_FAMILY_FORM);
    const [editForm, setEditForm] = useState<GuestFormState>(EMPTY_FORM);
    const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
    const [savingGuestId, setSavingGuestId] = useState<string | null>(null);
    const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);
    const [accommodationDraft, setAccommodationDraft] = useState<AccommodationDraft | null>(null);
    const [transportDraft, setTransportDraft] = useState<TransportDraft | null>(null);
    const [savingAccommodationId, setSavingAccommodationId] = useState<string | null>(null);
    const [savingTransportId, setSavingTransportId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingFamily, setIsCreatingFamily] = useState(false);
    const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
    const [isFamilyDrawerOpen, setIsFamilyDrawerOpen] = useState(false);
    const [pageError, setPageError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<GuestCategory | 'all'>('all');
    const [attendanceFilter, setAttendanceFilter] = useState<GuestAttendanceStatus | 'all'>('all');
    const [accommodationFilter, setAccommodationFilter] = useState<'all' | 'yes' | 'no'>('all');
    const displayedGuestList = localGuestList ?? guestList;
    const { items, groups } = displayedGuestList;

    useEffect(() => {
        setLocalGuestList(guestList);
    }, [guestList]);

    useEffect(() => {
        const updateActionsPosition = () => {
            const shell = tableShellRef.current;
            const actions = actionsRef.current;

            if (!shell || !actions || typeof window === 'undefined') {
                return;
            }

            if (window.innerWidth < 1280) {
                setFloatingActionsStyle(undefined);
                return;
            }

            const topOffset = 96;
            const gap = 24;
            const shellRect = shell.getBoundingClientRect();
            const actionsHeight = actions.offsetHeight;
            const actionsWidth = actions.offsetWidth;

            if (shellRect.top > topOffset) {
                setFloatingActionsStyle({
                    position: 'absolute',
                    left: `calc(100% + ${gap}px)`,
                    top: 0,
                    width: `${actionsWidth}px`,
                });
                return;
            }

            if (shellRect.bottom - actionsHeight > topOffset) {
                setFloatingActionsStyle({
                    position: 'fixed',
                    top: `${topOffset}px`,
                    left: `${shellRect.right + gap}px`,
                    width: `${actionsWidth}px`,
                });
                return;
            }

            setFloatingActionsStyle({
                position: 'absolute',
                left: `calc(100% + ${gap}px)`,
                top: `${Math.max(0, shell.offsetHeight - actionsHeight)}px`,
                width: `${actionsWidth}px`,
            });
        };

        updateActionsPosition();
        window.addEventListener('scroll', updateActionsPosition, { passive: true });
        window.addEventListener('resize', updateActionsPosition);

        return () => {
            window.removeEventListener('scroll', updateActionsPosition);
            window.removeEventListener('resize', updateActionsPosition);
        };
    }, [items.length, groups.length, editingGuestId]);

    const peopleSummary = useMemo(() => {
        const confirmedItems = items.filter(isGuestConfirmed);
        const invitedCount = items.length;
        const confirmedCount = confirmedItems.length;

        return {
            invitedCount,
            confirmedCount,
            confirmationPercent: invitedCount === 0 ? 0 : Math.round((confirmedCount * 1000) / invitedCount) / 10,
            attendingTotalWithCouple: confirmedCount + 2,
            adultsCount: items.filter((guest) => guest.category === 'adult' || guest.category === 'child_over_10').length,
            vendorsCount: items.filter((guest) => guest.category === 'vendor').length,
            children3To10Count: items.filter((guest) => guest.category === 'child_3_10').length,
            childrenUnder3Count: items.filter((guest) => guest.category === 'child_under_3').length,
            accommodationNeededCount: items.filter((guest) => guest.needsAccommodation).length,
            transportNeededCount: items.filter((guest) => guest.needsTransport).length,
        };
    }, [items]);

    const confirmedBreakdown = useMemo(() => {
        const confirmedItems = items.filter(isGuestConfirmed);

        return [
            {
                label: appText.admin.guests.summary.vendorsLong,
                value: confirmedItems.filter((guest) => guest.category === 'vendor').length,
            },
            {
                label: appText.admin.guests.summary.adultsAndChildrenOver10,
                value: confirmedItems.filter((guest) => guest.category === 'adult' || guest.category === 'child_over_10').length,
            },
            {
                label: 'Dzieci 3-10',
                value: confirmedItems.filter((guest) => guest.category === 'child_3_10').length,
            },
            {
                label: 'Dzieci do 3 lat',
                value: confirmedItems.filter((guest) => guest.category === 'child_under_3').length,
            },
        ];
    }, [items]);

    const accommodationByPlace = useMemo(() => {
        const counts = new Map<string, number>();

        items.forEach((guest) => {
            if (!guest.needsAccommodation) {
                return;
            }

            const placeLabel = guest.hotelName?.trim() || 'Do ustalenia';
            counts.set(placeLabel, (counts.get(placeLabel) ?? 0) + 1);
        });

        return [...counts.entries()]
            .map(([label, count]) => ({ label, count }))
            .sort((left, right) => {
                if (right.count !== left.count) {
                    return right.count - left.count;
                }

                if (left.label === 'Do ustalenia') {
                    return 1;
                }

                if (right.label === 'Do ustalenia') {
                    return -1;
                }

                return left.label.localeCompare(right.label, 'pl');
            });
    }, [items]);

    const filteredGuests = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return items.filter((guest) => {
            const matchesSearch = normalizedSearch.length === 0 ||
                guest.fullName.toLowerCase().includes(normalizedSearch) ||
                (guest.invitationGroupName ?? '').toLowerCase().includes(normalizedSearch) ||
                (guest.hotelName ?? '').toLowerCase().includes(normalizedSearch) ||
                (guest.roomNameOrNumber ?? '').toLowerCase().includes(normalizedSearch) ||
                (guest.transportNotes ?? '').toLowerCase().includes(normalizedSearch);
            const matchesCategory = categoryFilter === 'all' || guest.category === categoryFilter;
            const matchesAttendance = attendanceFilter === 'all' || guest.attendanceStatus === attendanceFilter;
            const matchesAccommodation = accommodationFilter === 'all' ||
                (accommodationFilter === 'yes' && guest.needsAccommodation) ||
                (accommodationFilter === 'no' && !guest.needsAccommodation);

            return matchesSearch && matchesCategory && matchesAttendance && matchesAccommodation;
        });
    }, [accommodationFilter, attendanceFilter, categoryFilter, items, searchTerm]);

    const groupedGuests = useMemo(() => {
        const groupsById = new Map(groups.map((group) => [group.id, group]));
        const result: Array<{
            key: string;
            label: string;
            invitationLabel?: string;
            guests: AdminGuestListEntry[];
            isGrouped: boolean;
        }> = [];
        const grouped = new Map<string, AdminGuestListEntry[]>();

        filteredGuests.forEach((guest) => {
            if (!guest.invitationGroupId) {
                result.push({
                    key: guest.id,
                    label: guest.fullName,
                    guests: [guest],
                    isGrouped: false,
                });
                return;
            }

            const current = grouped.get(guest.invitationGroupId) ?? [];
            current.push(guest);
            grouped.set(guest.invitationGroupId, current);
        });

        grouped.forEach((guests, groupId) => {
            const group = groupsById.get(groupId);
            result.push({
                key: groupId,
                label: group?.displayName ?? guests[0]?.invitationGroupName ?? 'Grupa zaproszenia',
                invitationLabel: group?.invitationLabel,
                guests,
                isGrouped: true,
            });
        });

        return result.sort((left, right) => {
            const rankDifference = getGuestBlockSortRank(left.guests) - getGuestBlockSortRank(right.guests);
            if (rankDifference !== 0) {
                return rankDifference;
            }

            return 0;
        });
    }, [filteredGuests, groups]);

    const invalidateAfterChange = () => {
        invalidateAdminCache('guests');
        invalidateAdminCache('overview');
    };

    const updateLocalGuest = (guestId: string, patch: Partial<AdminGuestListEntry>) => {
        setLocalGuestList((currentList) => {
            const sourceList = currentList ?? guestList;

            return {
                ...sourceList,
                items: sourceList.items.map((guest) => (
                    guest.id === guestId
                        ? { ...guest, ...patch }
                        : guest
                )),
            };
        });
    };

    const appendLocalGuest = (guest: AdminGuestListEntry) => {
        setLocalGuestList((currentList) => {
            const sourceList = currentList ?? guestList;

            return {
                ...sourceList,
                items: [...sourceList.items, guest],
            };
        });
    };

    const appendLocalFamily = (group: AdminGuestInvitationGroup, guests: AdminGuestListEntry[]) => {
        setLocalGuestList((currentList) => {
            const sourceList = currentList ?? guestList;
            const hasGroup = sourceList.groups.some((existingGroup) => existingGroup.id === group.id);

            return {
                ...sourceList,
                groups: hasGroup ? sourceList.groups : [...sourceList.groups, group],
                items: [...sourceList.items, ...guests],
            };
        });
    };

    const replaceLocalGuest = (guest: AdminGuestListEntry) => {
        setLocalGuestList((currentList) => {
            const sourceList = currentList ?? guestList;

            return {
                ...sourceList,
                items: sourceList.items.map((currentGuest) => (
                    currentGuest.id === guest.id ? guest : currentGuest
                )),
            };
        });
    };

    const removeLocalGuest = (guestId: string) => {
        setLocalGuestList((currentList) => {
            const sourceList = currentList ?? guestList;

            return {
                ...sourceList,
                items: sourceList.items.filter((guest) => guest.id !== guestId),
            };
        });
    };

    const resetCreateFormForNext = () => {
        setCreateForm((currentForm) => ({
            ...currentForm,
            fullName: '',
            notes: '',
        }));
    };

    const handleCreateGuest = async (closeAfterSave: boolean) => {
        setPageError(null);
        setIsCreating(true);

        try {
            const createdGuest = await adminClient.createGuest(createPayload(createForm));
            appendLocalGuest(createdGuest);
            if (closeAfterSave) {
                setCreateForm(EMPTY_FORM);
                setIsCreateDrawerOpen(false);
            } else {
                resetCreateFormForNext();
            }
            invalidateAfterChange();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.addPerson));
            logErrorDetails(err, 'Failed to create guest');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreateFamily = async () => {
        setPageError(null);
        setIsCreatingFamily(true);

        try {
            const createdFamily = await adminClient.createGuestFamily(createFamilyPayload(familyForm));
            appendLocalFamily(createdFamily.group, createdFamily.items);
            setFamilyForm(EMPTY_FAMILY_FORM);
            setIsFamilyDrawerOpen(false);
            invalidateAfterChange();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.addFamily));
            logErrorDetails(err, 'Failed to create guest family');
        } finally {
            setIsCreatingFamily(false);
        }
    };

    const handleStartEdit = (guest: AdminGuestListEntry) => {
        setEditingGuestId(guest.id);
        setEditForm(createFormState(guest));
    };

    const handleSaveGuest = async (guestId: string) => {
        setPageError(null);
        setSavingGuestId(guestId);

        try {
            const updatedGuest = await adminClient.updateGuest(guestId, createPayload(editForm));
            replaceLocalGuest(updatedGuest);
            setEditingGuestId(null);
            invalidateAfterChange();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.savePerson));
            logErrorDetails(err, 'Failed to update guest');
        } finally {
            setSavingGuestId(null);
        }
    };

    const handleQuickAttendanceChange = async (guest: AdminGuestListEntry, confirmed: boolean) => {
        if (guest.category === 'vendor') {
            return;
        }

        setPageError(null);
        setSavingGuestId(guest.id);
        updateLocalGuest(guest.id, {
            attendanceStatus: confirmed ? 'confirmed' : 'pending',
        });

        try {
            await adminClient.updateGuest(guest.id, {
                attendanceStatus: confirmed ? 'confirmed' : 'pending',
            });
            invalidateAfterChange();
        } catch (err: unknown) {
            updateLocalGuest(guest.id, guest);
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.attendance));
            logErrorDetails(err, 'Failed to update guest attendance');
        } finally {
            setSavingGuestId(null);
        }
    };

    const handleAccommodationToggle = async (guest: AdminGuestListEntry, checked: boolean) => {
        if (checked) {
            setAccommodationDraft({
                guest,
                hotelName: guest.hotelName ?? '',
                roomNameOrNumber: guest.roomNameOrNumber ?? '',
            });
            return;
        }

        setPageError(null);
        setSavingAccommodationId(guest.id);
        updateLocalGuest(guest.id, {
            needsAccommodation: false,
            hotelName: null,
            roomNameOrNumber: null,
        });

        try {
            await adminClient.updateGuest(guest.id, {
                needsAccommodation: false,
                hotelName: '',
                roomNameOrNumber: '',
            });
            invalidateAfterChange();
        } catch (err: unknown) {
            updateLocalGuest(guest.id, guest);
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.accommodationToggle));
            logErrorDetails(err, 'Failed to clear guest accommodation');
        } finally {
            setSavingAccommodationId(null);
        }
    };

    const handleSaveAccommodation = async () => {
        if (!accommodationDraft) {
            return;
        }

        setPageError(null);
        setSavingAccommodationId(accommodationDraft.guest.id);
        const currentDraft = accommodationDraft;
        updateLocalGuest(currentDraft.guest.id, {
            needsAccommodation: true,
            hotelName: currentDraft.hotelName.trim(),
            roomNameOrNumber: currentDraft.roomNameOrNumber.trim(),
        });
        setAccommodationDraft(null);

        try {
            await adminClient.updateGuest(currentDraft.guest.id, {
                needsAccommodation: true,
                hotelName: currentDraft.hotelName.trim(),
                roomNameOrNumber: currentDraft.roomNameOrNumber.trim(),
            });
            invalidateAfterChange();
        } catch (err: unknown) {
            updateLocalGuest(currentDraft.guest.id, currentDraft.guest);
            setAccommodationDraft(currentDraft);
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.accommodationSave));
            logErrorDetails(err, 'Failed to save guest accommodation');
        } finally {
            setSavingAccommodationId(null);
        }
    };

    const handleTransportToggle = async (guest: AdminGuestListEntry, checked: boolean) => {
        if (checked) {
            setTransportDraft({
                guest,
                transportNotes: guest.transportNotes ?? '',
            });
            return;
        }

        setPageError(null);
        setSavingTransportId(guest.id);
        updateLocalGuest(guest.id, {
            needsTransport: false,
            transportNotes: null,
        });

        try {
            await adminClient.updateGuest(guest.id, {
                needsTransport: false,
                transportNotes: '',
            });
            invalidateAfterChange();
        } catch (err: unknown) {
            updateLocalGuest(guest.id, guest);
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.transportToggle));
            logErrorDetails(err, 'Failed to clear guest transport');
        } finally {
            setSavingTransportId(null);
        }
    };

    const handleSaveTransport = async () => {
        if (!transportDraft) {
            return;
        }

        setPageError(null);
        setSavingTransportId(transportDraft.guest.id);
        const currentDraft = transportDraft;
        updateLocalGuest(currentDraft.guest.id, {
            needsTransport: true,
            transportNotes: currentDraft.transportNotes.trim(),
        });
        setTransportDraft(null);

        try {
            await adminClient.updateGuest(currentDraft.guest.id, {
                needsTransport: true,
                transportNotes: currentDraft.transportNotes.trim(),
            });
            invalidateAfterChange();
        } catch (err: unknown) {
            updateLocalGuest(currentDraft.guest.id, currentDraft.guest);
            setTransportDraft(currentDraft);
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.transportSave));
            logErrorDetails(err, 'Failed to save guest transport');
        } finally {
            setSavingTransportId(null);
        }
    };

    const handleDeleteGuest = async (guestId: string) => {
        if (!window.confirm(appText.admin.guests.deleteConfirm)) {
            return;
        }

        setPageError(null);
        setDeletingGuestId(guestId);

        try {
            await adminClient.deleteGuest(guestId);
            removeLocalGuest(guestId);
            invalidateAfterChange();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.guests.errors.deletePerson));
            logErrorDetails(err, 'Failed to delete guest');
        } finally {
            setDeletingGuestId(null);
        }
    };

    const inlineSummaryItems = [
        { label: appText.admin.guests.summary.confirmed, value: `${peopleSummary.confirmedCount}/${peopleSummary.invitedCount}`, suffix: `${peopleSummary.confirmationPercent}%` },
        { label: appText.admin.guests.summary.totalWithCouple, value: String(peopleSummary.attendingTotalWithCouple) },
        { label: appText.admin.guests.summary.adults, value: String(peopleSummary.adultsCount) },
        { label: appText.admin.guests.summary.vendors, value: String(peopleSummary.vendorsCount) },
        { label: 'Dzieci 3-10', value: String(peopleSummary.children3To10Count) },
        { label: 'Dzieci do 3 lat', value: String(peopleSummary.childrenUnder3Count) },
        { label: appText.admin.guests.table.accommodation, value: String(peopleSummary.accommodationNeededCount) },
        { label: appText.admin.guests.table.transport, value: String(peopleSummary.transportNeededCount) },
    ];

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink />
                    <PageHeader
                        title={appText.admin.guests.title}
                        helpText={appText.admin.guests.helpText}
                    />

                    {pageError ? (
                        <div className="mt-8">
                            <ApiErrorAlert message={pageError} />
                        </div>
                    ) : null}

                    <div className="mx-auto mt-8 max-w-6xl">
                        <Card className="p-5">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
                                <Field label="Szukaj" htmlFor="guest-search">
                                    <Input
                                        id="guest-search"
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder={appText.admin.guests.searchPlaceholder}
                                        className="admin-toolbar-control"
                                    />
                                </Field>
                                <Field label={appText.admin.guests.forms.category} htmlFor="guest-category-filter">
                                    <Select
                                        id="guest-category-filter"
                                        value={categoryFilter}
                                        onChange={(event) => setCategoryFilter(event.target.value as GuestCategory | 'all')}
                                        className="admin-toolbar-control"
                                    >
                                        <option value="all">Wszystkie</option>
                                        {CATEGORY_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label={appText.admin.guests.attendance} htmlFor="guest-attendance-filter">
                                    <Select
                                        id="guest-attendance-filter"
                                        value={attendanceFilter}
                                        onChange={(event) => setAttendanceFilter(event.target.value as GuestAttendanceStatus | 'all')}
                                        className="admin-toolbar-control"
                                    >
                                        <option value="all">Wszystkie</option>
                                        {ATTENDANCE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label={appText.admin.guests.table.accommodation} htmlFor="guest-accommodation-filter">
                                    <Select
                                        id="guest-accommodation-filter"
                                        value={accommodationFilter}
                                        onChange={(event) => setAccommodationFilter(event.target.value as 'all' | 'yes' | 'no')}
                                        className="admin-toolbar-control"
                                    >
                                        <option value="all">Wszystkie</option>
                                        <option value="yes">Potrzebuje</option>
                                        <option value="no">Bez noclegu</option>
                                    </Select>
                                </Field>
                            </div>
                        </Card>
                    </div>

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={items.length === 0}
                        emptyMessage={appText.admin.guests.empty}
                        loadingFallback={<GuestsSkeleton />}
                    >
                        <div className="mx-auto mt-5 max-w-6xl">
                            <div className="guest-list-status-line">
                                <p className="font-sans text-sm text-muted">
                                    {appText.admin.guests.shownPrefix} {filteredGuests.length} {appText.admin.guests.shownMiddle} {items.length} {appText.admin.guests.shownSuffix}
                                </p>
                                <div className="guest-list-inline-summary">
                                    {inlineSummaryItems.map((item) => (
                                        <span key={item.label} className="guest-list-inline-summary-item">
                                            <span className="text-muted">{item.label}</span>
                                            <strong className="text-ink">{item.value}</strong>
                                            {item.suffix ? <span className="text-muted">{item.suffix}</span> : null}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                                <Card className="p-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <p className="font-serif text-lg text-ink">Potwierdzeni</p>
                                        <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted">
                                            {appText.admin.guests.byGuestTypes}
                                        </p>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {confirmedBreakdown.map((item) => (
                                            <span key={item.label} className="guest-summary-metric">
                                                <span className="block font-sans text-xs text-muted">{item.label}</span>
                                                <strong className="mt-1 block text-lg text-ink">{item.value}</strong>
                                            </span>
                                        ))}
                                    </div>
                                </Card>

                                <Card className="p-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <p className="font-serif text-lg text-ink">Noclegi</p>
                                        <p className="font-sans text-xs uppercase tracking-[0.18em] text-muted">
                                            pogrupowane miejscami
                                        </p>
                                    </div>
                                    {accommodationByPlace.length === 0 ? (
                                        <p className="mt-3 text-sm text-muted">Nikt obecnie nie ma zaznaczonego noclegu.</p>
                                    ) : (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {accommodationByPlace.map((item) => (
                                                <span key={item.label} className="guest-summary-metric">
                                                    <span className="block font-sans text-xs text-muted">{item.label}</span>
                                                    <strong className="mt-1 block text-lg text-ink">{item.count}</strong>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </div>

                            <div ref={tableShellRef} className="guest-list-table-shell">
                                <div
                                    ref={actionsRef}
                                    className="guest-list-actions-column"
                                    style={floatingActionsStyle}
                                    aria-label={appText.admin.guests.addGuestsAriaLabel}
                                >
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="guest-floating-action-button"
                                        onClick={() => setIsFamilyDrawerOpen(true)}
                                    >
                                        {appText.admin.guests.addGroup}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        className="guest-floating-action-button"
                                        onClick={() => setIsCreateDrawerOpen(true)}
                                    >
                                        {appText.admin.guests.addPerson}
                                    </Button>
                                </div>

                                <div className="admin-table-wrap">
                                    <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>{appText.admin.guests.table.person}</th>
                                            <th>{appText.admin.guests.table.category}</th>
                                            <th>{appText.admin.guests.attendance}</th>
                                            <th>{appText.admin.guests.table.accommodation}</th>
                                            <th>{appText.admin.guests.table.transport}</th>
                                            <th>{appText.admin.guests.table.note}</th>
                                            <th>{appText.admin.guests.table.actions}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGuests.length === 0 ? (
                                            <tr>
                                                <td colSpan={7}>
                                                    <p className="py-6 text-center text-sm text-muted">
                                                        {appText.admin.guests.noFilterResults}
                                                    </p>
                                                </td>
                                            </tr>
                                        ) : null}
                                        {groupedGuests.map((guestGroup) => (
                                            <Fragment key={guestGroup.key}>
                                                {guestGroup.isGrouped ? (
                                                    <tr className="admin-table-group-row">
                                                        <td colSpan={7}>
                                                            <div className="flex flex-wrap items-baseline gap-2">
                                                                <p className="font-serif text-lg text-ink">{guestGroup.label}</p>
                                                                <p className="font-sans text-xs text-muted">{guestGroup.guests.length} {appText.admin.guests.peopleSuffix}</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                                {guestGroup.guests.map((guest, guestIndex) => {
                                                    const attendance = getAttendanceMetadata(guest.attendanceStatus);
                                                    const isEditing = editingGuestId === guest.id;
                                                    const isBusy = savingGuestId === guest.id || deletingGuestId === guest.id;
                                                    const rowClassName = guestGroup.isGrouped && guestIndex === guestGroup.guests.length - 1
                                                        ? 'admin-table-group-last-row'
                                                        : undefined;

                                                    if (isEditing) {
                                                        return (
                                                            <tr key={guest.id} className={rowClassName}>
                                                                <td colSpan={7}>
                                                                    <GuestForm
                                                                        form={editForm}
                                                                        setForm={setEditForm}
                                                                        saving={savingGuestId === guest.id}
                                                                        primarySubmitLabel="Zapisz"
                                                                        onPrimarySubmit={() => void handleSaveGuest(guest.id)}
                                                                        onCancel={() => setEditingGuestId(null)}
                                                                        groups={groups}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return (
                                                        <tr key={guest.id} className={rowClassName}>
                                                            <td>
                                                                <p className="font-medium text-ink">{guest.fullName}</p>
                                                            </td>
                                                            <td>{getCategoryLabel(guest.category)}</td>
                                                            <td>
                                                                <div className="flex min-w-36 flex-col gap-1">
                                                                    <Checkbox
                                                                        className="checkbox-field-compact"
                                                                        label={guest.category === 'vendor' ? 'Potwierdzono' : (guest.attendanceStatus === 'confirmed' ? 'Potwierdzono' : 'Niepotwierdzone')}
                                                                        checked={guest.category === 'vendor' || guest.attendanceStatus === 'confirmed'}
                                                                        disabled={guest.category === 'vendor' || isBusy}
                                                                        onChange={(event) => void handleQuickAttendanceChange(guest, event.target.checked)}
                                                                    />
                                                                    {guest.attendanceStatus === 'declined' ? (
                                                                        <StatusBadge label={attendance.label} tone={attendance.tone} />
                                                                    ) : null}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="flex min-w-36 flex-col gap-1">
                                                                    <Checkbox
                                                                        className="checkbox-field-compact"
                                                                        label={guest.needsAccommodation ? appText.common.toggles.yes : appText.common.toggles.no}
                                                                        checked={guest.needsAccommodation}
                                                                        disabled={savingAccommodationId === guest.id || isBusy}
                                                                        onChange={(event) => void handleAccommodationToggle(guest, event.target.checked)}
                                                                    />
                                                                    {guest.needsAccommodation ? (
                                                                        <button
                                                                            type="button"
                                                                            className="max-w-36 truncate text-left text-xs text-muted underline-offset-4 hover:text-gold hover:underline"
                                                                            onClick={() => setAccommodationDraft({
                                                                                guest,
                                                                                hotelName: guest.hotelName ?? '',
                                                                                roomNameOrNumber: guest.roomNameOrNumber ?? '',
                                                                            })}
                                                                        >
                                                                            {guest.hotelName || appText.admin.guests.table.hotelToSet}{guest.roomNameOrNumber ? `, ${guest.roomNameOrNumber}` : ''}
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <div className="flex min-w-36 flex-col gap-1">
                                                                    <Checkbox
                                                                        className="checkbox-field-compact"
                                                                        label={guest.needsTransport ? appText.common.toggles.yes : appText.common.toggles.no}
                                                                        checked={guest.needsTransport}
                                                                        disabled={savingTransportId === guest.id || isBusy}
                                                                        onChange={(event) => void handleTransportToggle(guest, event.target.checked)}
                                                                    />
                                                                    {guest.needsTransport ? (
                                                                        <button
                                                                            type="button"
                                                                            className="max-w-36 truncate text-left text-xs text-muted underline-offset-4 hover:text-gold hover:underline"
                                                                            onClick={() => setTransportDraft({
                                                                                guest,
                                                                                transportNotes: guest.transportNotes ?? '',
                                                                            })}
                                                                        >
                                                                            {guest.transportNotes || appText.admin.guests.transportToSet}
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <p className="max-w-44 truncate text-sm text-muted">
                                                                    {guest.notes || 'Brak'}
                                                                </p>
                                                            </td>
                                                            <td>
                                                                <div className="flex flex-nowrap gap-2">
                                                                    <IconButton
                                                                        label={appText.admin.guests.editPerson}
                                                                        icon={<PencilIcon />}
                                                                        disabled={isBusy}
                                                                        onClick={() => handleStartEdit(guest)}
                                                                    />
                                                                    <IconButton
                                                                        label={appText.admin.guests.deletePerson}
                                                                        icon={<TrashIcon />}
                                                                        tone="danger"
                                                                        loading={deletingGuestId === guest.id}
                                                                        disabled={savingGuestId !== null}
                                                                        onClick={() => void handleDeleteGuest(guest.id)}
                                                                    />
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </PageState>
                </Section>
            </div>
            <Drawer
                open={isFamilyDrawerOpen}
                title={appText.admin.guests.forms.addGroupTitle}
                description={appText.admin.guests.forms.addGroupDescription}
                onClose={() => setIsFamilyDrawerOpen(false)}
            >
                <FamilyForm
                    form={familyForm}
                    setForm={setFamilyForm}
                    saving={isCreatingFamily}
                    onSubmit={() => void handleCreateFamily()}
                    onCancel={() => setIsFamilyDrawerOpen(false)}
                />
            </Drawer>
            <Drawer
                open={isCreateDrawerOpen}
                title={appText.admin.guests.forms.addPersonTitle}
                description={appText.admin.guests.forms.addPersonDescription}
                onClose={() => setIsCreateDrawerOpen(false)}
            >
                <GuestForm
                    form={createForm}
                    setForm={setCreateForm}
                    saving={isCreating}
                    primarySubmitLabel={appText.admin.guests.forms.addAndNext}
                    secondarySubmitLabel="Dodaj i zamknij"
                    onPrimarySubmit={() => void handleCreateGuest(false)}
                    onSecondarySubmit={() => void handleCreateGuest(true)}
                    onCancel={() => setIsCreateDrawerOpen(false)}
                    notesMode="toggle"
                    groups={groups}
                />
            </Drawer>
            <Modal
                open={accommodationDraft !== null}
                title="Dane noclegu"
                onClose={() => setAccommodationDraft(null)}
            >
                {accommodationDraft ? (
                    <div className="grid gap-5">
                        <p className="font-sans text-sm text-muted">
                            {accommodationDraft.guest.fullName}
                        </p>
                        <Field label={appText.admin.guests.forms.hotel} htmlFor="accommodation-hotel">
                            <Input
                                id="accommodation-hotel"
                                value={accommodationDraft.hotelName}
                                onChange={(event) => setAccommodationDraft({
                                    ...accommodationDraft,
                                    hotelName: event.target.value,
                                })}
                                placeholder="Np. Willa Poprad"
                            />
                        </Field>
                        <Field label={appText.admin.guests.forms.room} htmlFor="accommodation-room">
                            <Input
                                id="accommodation-room"
                                value={accommodationDraft.roomNameOrNumber}
                                onChange={(event) => setAccommodationDraft({
                                    ...accommodationDraft,
                                    roomNameOrNumber: event.target.value,
                                })}
                                placeholder="Np. 12 / rodzinny / do ustalenia"
                            />
                        </Field>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                type="button"
                                variant="primary"
                                loading={savingAccommodationId === accommodationDraft.guest.id}
                                onClick={() => void handleSaveAccommodation()}
                            >
                                Zapisz nocleg
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={savingAccommodationId === accommodationDraft.guest.id}
                                onClick={() => setAccommodationDraft(null)}
                            >
                                Anuluj
                            </Button>
                        </div>
                    </div>
                ) : null}
            </Modal>
            <Modal
                open={transportDraft !== null}
                title="Dane transportu"
                onClose={() => setTransportDraft(null)}
            >
                {transportDraft ? (
                    <div className="grid gap-5">
                        <p className="font-sans text-sm text-muted">
                            {transportDraft.guest.fullName}
                        </p>
                        <Field label="Notatka o transporcie" htmlFor="transport-notes">
                            <Textarea
                                id="transport-notes"
                                rows={4}
                                value={transportDraft.transportNotes}
                                onChange={(event) => setTransportDraft({
                                    ...transportDraft,
                                    transportNotes: event.target.value,
                                })}
                                placeholder="Np. bus z hotelu, transport po poprawinach, fotelik dla dziecka"
                            />
                        </Field>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                type="button"
                                variant="primary"
                                loading={savingTransportId === transportDraft.guest.id}
                                onClick={() => void handleSaveTransport()}
                            >
                                Zapisz transport
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={savingTransportId === transportDraft.guest.id}
                                onClick={() => setTransportDraft(null)}
                            >
                                Anuluj
                            </Button>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </Layout>
    );
}
