import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'info' | 'warning' | 'success';
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        options: ConfirmOptions;
    }>({
        isOpen: false,
        options: { title: '', message: '' }
    });

    const resolver = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback((options: ConfirmOptions) => {
        setModalState({ isOpen: true, options });
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setModalState(prev => ({ ...prev, isOpen: false }));
        resolver.current?.(true);
    }, []);

    const handleCancel = useCallback(() => {
        setModalState(prev => ({ ...prev, isOpen: false }));
        resolver.current?.(false);
    }, []);

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            <ConfirmationModal
                isOpen={modalState.isOpen}
                title={modalState.options.title}
                message={modalState.options.message}
                confirmText={modalState.options.confirmText}
                cancelText={modalState.options.cancelText}
                variant={modalState.options.variant}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context.confirm;
}
