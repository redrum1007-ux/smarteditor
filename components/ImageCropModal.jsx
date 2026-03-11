import React, { useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export default function ImageCropModal({ imageFile, onCropComplete, onCancel }) {
  const [upImg, setUpImg] = useState(() => URL.createObjectURL(imageFile));
  const [crop, setCrop] = useState({ unit: '%', width: 50, height: 50 }); // 초기 자유 비율
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  // 크롭 영역이 확정되었을 때 실제 이미지 파일(Blob)로 변환하는 함수
  const generateCroppedImage = () => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    const image = imgRef.current;
    
    // 원본 이미지 비율과 화면에 보여지는 비율의 차이 계산
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    // 캔버스에 잘라낸 영역만 그리기
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    // 그려진 캔버스를 Blob(파일 형태)으로 변환 후 부모에게 전달
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas is empty');
        return;
      }
      onCropComplete(blob);
    }, 'image/jpeg', 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center max-w-2xl w-full">
        <h2 className="text-xl font-bold mb-4">이미지 자르기 (자유 비율)</h2>
        
        <div className="max-h-[60vh] overflow-auto mb-4 border bg-gray-50">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
          >
            <img 
              ref={imgRef} 
              src={upImg} 
              alt="Crop preview" 
              className="max-w-full"
            />
          </ReactCrop>
        </div>

        <div className="flex gap-4 mt-2">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded font-semibold">취소</button>
          <button onClick={generateCroppedImage} className="px-4 py-2 bg-blue-600 text-white rounded font-semibold">
            자르기 완료 및 캔버스 추가
          </button>
        </div>
      </div>
    </div>
  );
}
