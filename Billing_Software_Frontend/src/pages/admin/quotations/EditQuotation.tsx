import React from 'react';
import { useParams } from 'react-router-dom';
import CreateNewQuotation from './CreateNewQuotation';

const EditQuotation: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    return <CreateNewQuotation mode="edit" quotationId={id} />;
};

export default EditQuotation;
