import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3001,
        open: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        // React core
                        if (id.includes('react-dom') || id.includes('/react/')) {
                            return 'vendor-react';
                        }
                        // React Router
                        if (id.includes('react-router')) {
                            return 'vendor-router';
                        }
                        // Radix UI
                        if (id.includes('@radix-ui')) {
                            return 'vendor-radix';
                        }
                        // TanStack Query
                        if (id.includes('@tanstack')) {
                            return 'vendor-query';
                        }
                        // Supabase
                        if (id.includes('@supabase')) {
                            return 'vendor-supabase';
                        }
                        // Charts
                        if (id.includes('recharts') || id.includes('d3-')) {
                            return 'vendor-charts';
                        }
                        // Icons
                        if (id.includes('lucide-react')) {
                            return 'vendor-icons';
                        }
                    }
                },
            },
        },
    },
});
