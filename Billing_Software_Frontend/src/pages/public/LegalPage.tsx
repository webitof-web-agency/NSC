import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import Constants from '@constants/api';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import logoImage from '@assets/images/logo.png';
import { resolveAssetUrl } from '@utils/assetUrl';

interface LegalPageProps {
    documentType: 'privacyPolicy' | 'termsAndConditions' | 'dataDeletion';
    title: string;
}

const LegalPage: React.FC<LegalPageProps> = ({ documentType, title }) => {
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);

    useEffect(() => {
        document.title = `${title} | Legal`;
        fetchContent();
    }, [documentType]);

    const fetchContent = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(Constants.PUBLIC_LEGAL_URL);
            if (response.data?.success) {
                const content = response.data.data[documentType];
                if (content) {
                    setHtmlContent(content);
                } else {
                    setError('Content not available.');
                }
            } else {
                setError('Failed to fetch content.');
            }
        } catch (err) {
            console.error('Error fetching legal content:', err);
            setError('An error occurred while fetching the legal document.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="w-full max-w-4xl bg-white shadow-md rounded-xl overflow-hidden">
                <div className="bg-primary px-6 py-8 md:p-10 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <ShieldAlert size={48} className="text-white/80" />
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                            <p className="mt-2 text-white/80 text-sm">Please review our latest {title.toLowerCase()}.</p>
                        </div>
                    </div>
                    <img
                        src={resolveAssetUrl(systemSettings?.company?.siteLogo) || logoImage}
                        alt="Logo"
                        className="w-32 bg-white p-2 rounded-lg"
                    />
                </div>
                
                <div className="p-6 md:p-10">
                    {isLoading ? (
                        <div className="animate-pulse space-y-6">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                            <div className="h-4 bg-gray-200 rounded w-full mt-8"></div>
                            <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-700 font-medium bg-red-100 border border-red-300 rounded-lg">
                            {error}
                        </div>
                    ) : (
                        <div 
                            className="prose max-w-none text-gray-700
                            prose-h2:text-2xl prose-h2:font-bold prose-h2:text-gray-900 prose-h2:mt-8 prose-h2:mb-4
                            prose-h3:text-xl prose-h3:font-semibold prose-h3:text-gray-800 prose-h3:mt-6 prose-h3:mb-3
                            prose-p:leading-relaxed prose-p:mb-4
                            prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4
                            prose-li:mb-2
                            prose-a:text-primary prose-a:font-medium hover:prose-a:text-gray-900"
                            dangerouslySetInnerHTML={{ __html: htmlContent }} 
                        />
                    )}
                </div>
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-center text-sm text-gray-500">
                    &copy; {new Date().getFullYear()} All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default LegalPage;
