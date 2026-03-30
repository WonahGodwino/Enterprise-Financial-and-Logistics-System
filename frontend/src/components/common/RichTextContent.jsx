import React from 'react';
import DOMPurify from 'dompurify';

const RichTextContent = ({ html, className = '' }) => {
  const rawHtml = html || '';
  const sanitized = DOMPurify.sanitize(rawHtml);

  if (!sanitized || sanitized === '<p><br></p>') {
    return <p className="text-sm text-gray-600">No job description provided yet.</p>;
  }

  return (
    <div
      className={`rich-text-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export default RichTextContent;
