import { useRef, useEffect } from "react";
import { Search, SearchX, Users } from "lucide-react";

// ─── WargaSearchBar ───────────────────────────────────────────────────────────

interface WargaSearchBarProps {
    value: string;
    onChange: (val: string) => void;
    isSearching: boolean;
    resultCount?: number;
}

export function WargaSearchBar({ value, onChange, isSearching, resultCount }: WargaSearchBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Shortcut: "/" untuk fokus ke search
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (
                e.key === "/" &&
                document.activeElement?.tagName !== "INPUT" &&
                document.activeElement?.tagName !== "TEXTAREA"
            ) {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    return (
        <div className="relative flex-1 max-w-md group">
            {/* Icon kiri: spin saat searching */}
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                {isSearching ? (
                    <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                ) : (
                    <svg
                        className="h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors duration-200"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
                    </svg>
                )}
            </div>

            <input
                ref={inputRef}
                type="text"
                placeholder="Cari nama, email, atau alamat warga..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={[
                    "w-full h-11 pl-10 pr-20 rounded-xl text-sm",
                    "bg-white text-slate-800 placeholder:text-slate-400",
                    "border border-slate-300",
                    "shadow-sm",
                    "outline-none",
                    "transition-all duration-200",
                    "focus:border-slate-600 focus:ring-2 focus:ring-slate-600/10 focus:shadow-md",
                    "hover:border-slate-400",
                ].join(" ")}
            />

            {/* Pesan akan muncul jika input ada isinya tapi kurang dari 3 huruf */}
            {value.length > 0 && value.length < 3 && (
                <p className="absolute -bottom-5 left-2 text-[11px] text-amber-600 font-medium">
                    Ketik minimal 3 huruf untuk mulai mencari...
                </p>
            )}

            {/* Badge: jumlah hasil atau shortcut hint */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                {value.length >= 3 && !isSearching && resultCount !== undefined ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {resultCount} hasil
                    </span>
                ) : !value ? (
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-400 select-none">
                        /
                    </kbd>
                ) : null}
            </div>
        </div>
    );
}

// ─── WargaEmptySearchState ────────────────────────────────────────────────────

interface WargaEmptySearchStateProps {
    searchQuery?: string; // Tambahkan prop ini dari Parent Component
}

export function WargaEmptySearchState({ searchQuery = "" }: WargaEmptySearchStateProps) {
    const isNotFound = searchQuery.length >= 3;

    // === STATE: TIDAK DITEMUKAN ===
    if (isNotFound) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 animate-in fade-in duration-300">
                <div className="relative mb-5">
                    <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                        {/* Menggunakan Lucide Icon: SearchX */}
                        <SearchX className="h-12 w-12 text-slate-400" />
                    </div>
                </div>
                <h3 className="text-base font-semibold text-slate-700 mb-1 text-center">
                    Warga Tidak Ditemukan
                </h3>
                <p className="text-sm text-slate-500 text-center max-w-sm">
                    Kami tidak dapat menemukan data yang cocok dengan kata kunci <span className="font-semibold text-slate-700">"{searchQuery}"</span>.
                </p>
                <p className="mt-2 text-xs text-slate-400 text-center">
                    Coba periksa kembali ejaan atau gunakan kata kunci lain.
                </p>
            </div>
        );
    }

    // === STATE: MULAI MENCARI ===
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 animate-in fade-in duration-300">
            {/* Ilustrasi */}
            <div className="relative mb-6">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-inner">
                    {/* Menggunakan Lucide Icon: Users & Search digabung agar relevan */}
                    <div className="relative">
                        <Users className="h-10 w-10 text-slate-400" />
                        <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-slate-100">
                           <Search className="h-4 w-4 text-primary" />
                        </div>
                    </div>
                </div>
            </div>

            <h3 className="text-base font-semibold text-slate-700 mb-1">Cari Data Warga</h3>
            <p className="text-sm text-slate-400 text-center max-w-xs">
                Ketikkan nama, email, atau alamat warga pada kolom pencarian untuk menampilkan hasilnya.
            </p>

            {/* Tips */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {["Nama lengkap", "Email", "Alamat", "No. HP"].map((tip) => (
                    <span
                        key={tip}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1"
                    >
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        {tip}
                    </span>
                ))}
            </div>

            <p className="mt-4 text-xs text-slate-400">
                Tekan{" "}
                <kbd className="inline-flex h-5 items-center rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-500 shadow-sm">
                    /
                </kbd>{" "}
                untuk langsung ke pencarian
            </p>
        </div>
    );
}