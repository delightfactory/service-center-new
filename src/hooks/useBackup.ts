import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface BackupLog {
    id: string;
    backup_type: string;
    operation: 'export' | 'restore';
    status: 'in_progress' | 'completed' | 'failed';
    total_records: number;
    started_at: string;
    completed_at?: string;
    error_message?: string;
    metadata?: any;
}

export interface BackupInfo {
    last_backup_date: string;
    total_records: number;
    size_bytes: number;
    metadata: any;
}

export const useBackup = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const exportBackup = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase.rpc('export_backup_data', { p_type: 'full' });

            if (error) throw error;

            // Create downloadable file
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const restoreBackup = async (file: File) => {
        setIsLoading(true);
        setError(null);
        try {
            const text = await file.text();
            const json = JSON.parse(text);

            // Basic validation
            if (!json.data || !json.version) {
                throw new Error('Invalid backup file format');
            }

            const { error } = await supabase.rpc('restore_backup_data', { p_backup_json: json });

            if (error) throw error;

        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const getBackupInfo = async () => {
        const { data, error } = await supabase.rpc('get_backup_info');
        if (error) throw error;
        return data as BackupInfo;
    };

    const getBackupLogs = async () => {
        const { data, error } = await supabase
            .from('backup_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        return data as BackupLog[];
    };

    return {
        exportBackup,
        restoreBackup,
        getBackupInfo,
        getBackupLogs,
        isLoading,
        error
    };
};
