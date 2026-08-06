import React from 'react';

interface LightboxProps {
  src: string | null;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ src, onClose }) => {
  if (!src) return null;

  return (
    <div className="lightbox open" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>
        <i className="fa-solid fa-xmark"></i>
      </button>
      <img
        src={src}
        alt="Full screen preview"
        onClick={(e) => e.stopPropagation()}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '';
          (e.target as HTMLImageElement).alt = 'Failed to load image';
        }}
      />
    </div>
  );
};
export default Lightbox;
