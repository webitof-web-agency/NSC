export interface StaffFormData {
    id?: string | number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    dateOfBirth: Date;
    password: string;
    confirmPassword: string;
    address: string;
    roleid: string;
    profileImage: File | null;
    profile_image_preview_url: string | null;
    profile_image_removed: boolean;
    commissionPercent: number;   // <-- ADD THIS
    amountPerDay: number;        // <-- ADD THIS
}

export interface StaffList {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string | null;
    roleid: string;
    roleName: string;
    profileImage: string;
    createdAt: string;
    commissionPercent: number;     // ADD THIS
    amountPerDay?: number;         // ADD THIS
}
