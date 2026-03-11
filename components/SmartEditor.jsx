import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { jsPDF } from 'jspdf';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const CANVAS_WIDTH = 860;

// ==========================================
// [1] 크롭 모달 컴포넌트
// ==========================================
function ImageCropModal({ imageUrl, onCropComplete, onCancel }) {
    const [crop, setCrop] = useState({ unit: '%', width: 50, height: 50 });
    const [completedCrop, setCompletedCrop] = useState(null);
    const imgRef = useRef(null);

    const generateCroppedImage = () => {
        if (!completedCrop || !completedCrop.width || !completedCrop.height || !imgRef.current) {
            alert("자를 영역을 마우스로 드래그해주세요!");
            return;
        }

        const canvas = document.createElement('canvas');
        const image = imgRef.current;
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        canvas.width = completedCrop.width;
        canvas.height = completedCrop.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            image,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0, 0, completedCrop.width, completedCrop.height
        );

        const base64Image = canvas.toDataURL('image/jpeg', 1.0);
        onCropComplete(base64Image);
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-75">
            <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center max-w-2xl w-full">
                <h2 className="text-xl font-bold mb-4">이미지 자르기</h2>
                <div className="max-h-[60vh] overflow-auto mb-4 border bg-gray-50 flex justify-center">
                    <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
                        {/* crossOrigin="anonymous" is often needed if images are from external domains, but for local FileReader data URLs it's fine without, though safe to keep. */}
                        <img ref={imgRef} src={imageUrl} alt="Crop preview" crossOrigin="anonymous" className="max-w-full" />
                    </ReactCrop>
                </div>
                <div className="flex gap-4 mt-2">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded font-bold hover:bg-gray-400">취소</button>
                    <button onClick={generateCroppedImage} className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">
                        자르기 완료 및 적용
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// [2] 스마트 에디터 메인 컴포넌트
// ==========================================
export default function SmartEditor() {
    const canvasRef = useRef(null);
    const fabricCanvasRef = useRef(null);
    const [fontFamily, setFontFamily] = useState('Arita-dotum');
    const [textAlign, setTextAlign] = useState('center');
    const [textColor, setTextColor] = useState('#000000');
    const [fontWeight, setFontWeight] = useState('normal');
    const [shapeColor, setShapeColor] = useState('#3498db');
    
    // 이미지 순서 및 관리용 상태
    const [imageList, setImageList] = useState([]);
    const imageObjectsRef = useRef([]); // fabric.Image 객체들의 실제 배열

    // 크롭 관련 상태
    const [cropImageId, setCropImageId] = useState(null);
    const [cropImageUrl, setCropImageUrl] = useState(null);

    // 드래그 앤 드롭 상태용
    const [draggedIndex, setDraggedIndex] = useState(null);

    // 복사/붙여넣기 상태용 참조
    const clipboardRef = useRef(null);

    // 메모장 상태용
    const [isMemoOpen, setIsMemoOpen] = useState(false);
    const [memoText, setMemoText] = useState('');

    // 메모장 드래그 및 위치용 상태
    const [memoPosition, setMemoPosition] = useState({ x: 20, y: 500 });
    const isDraggingMemo = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        // 브라우저 렌더링 후 초기 위치 잡기 (좌측 하단)
        setMemoPosition({ x: 20, y: Math.max(0, window.innerHeight - 350) });
    }, []);

    const handleMemoMouseDown = (e) => {
        isDraggingMemo.current = true;
        dragStartPos.current = {
            x: e.clientX - memoPosition.x,
            y: e.clientY - memoPosition.y,
        };
    };

    const handleMemoMouseMove = (e) => {
        if (!isDraggingMemo.current) return;
        setMemoPosition({
            x: e.clientX - dragStartPos.current.x,
            y: e.clientY - dragStartPos.current.y,
        });
    };

    const handleMemoMouseUp = () => {
        isDraggingMemo.current = false;
    };

    // 글로벌 마우스 이벤트 (드래그 시 마우스가 메모장을 벗어나도 부드럽게 유지되도록)
    useEffect(() => {
        if (isMemoOpen) {
            window.addEventListener('mousemove', handleMemoMouseMove);
            window.addEventListener('mouseup', handleMemoMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMemoMouseMove);
            window.removeEventListener('mouseup', handleMemoMouseUp);
        };
    }, [isMemoOpen, memoPosition]);

    useEffect(() => {
        // 로컬 스토리지에서 기존 메모 불러오기
        const savedMemo = localStorage.getItem('smartEditor_memoText');
        if (savedMemo) {
            setMemoText(savedMemo);
        }
    }, []);

    const handleMemoChange = (e) => {
        setMemoText(e.target.value);
        localStorage.setItem('smartEditor_memoText', e.target.value);
    };

    useEffect(() => {
        // Initialize Fabric.js Canvas
        const canvas = new fabric.Canvas(canvasRef.current, {
            width: CANVAS_WIDTH,
            height: 800,
            backgroundColor: '#ffffff',
            preserveObjectStacking: true
        });
        fabricCanvasRef.current = canvas;

        return () => {
            canvas.dispose();
            fabricCanvasRef.current = null;
        };
    }, []);

    // 복사/붙여넣기 단축키 이벤트 리스너
    useEffect(() => {
        const handleKeyDown = (e) => {
            const canvas = fabricCanvasRef.current;
            if (!canvas) return;
            
            const activeObject = canvas.getActiveObject();
            
            // 텍스트 편집 모드일 때는 브라우저 기본 복사/붙여넣기가 동작하도록 예외처리
            if (activeObject && activeObject.isEditing) {
                return;
            }

            // 객체 지우기 (Delete or Backspace)
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (activeObject) {
                    // 배경으로 고정된 이미지는 삭제 방지용 방어 코드
                    if (activeObject.selectable === false || activeObject.evented === false) {
                        return;
                    }
                    e.preventDefault();
                    
                    if (activeObject.type === 'activeSelection') {
                        activeObject.forEachObject((obj) => {
                            canvas.remove(obj);
                        });
                    } else {
                        canvas.remove(activeObject);
                    }
                    canvas.discardActiveObject();
                    canvas.renderAll();
                }
                return;
            }

            // Ctrl/Cmd 키가 눌렸을 때 (복사 / 붙여넣기)
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c' || e.key === 'C') {
                    if (activeObject) {
                        activeObject.clone((cloned) => {
                            clipboardRef.current = cloned;
                        });
                    }
                } else if (e.key === 'v' || e.key === 'V') {
                    if (clipboardRef.current) {
                        clipboardRef.current.clone((clonedObj) => {
                            canvas.discardActiveObject();
                            clonedObj.set({
                                left: clonedObj.left + 20, // 겹치지 않게 20px 이동
                                top: clonedObj.top + 20,
                                evented: true,
                            });
                            
                            if (clonedObj.type === 'activeSelection') {
                                clonedObj.canvas = canvas;
                                clonedObj.forEachObject((obj) => {
                                    canvas.add(obj);
                                });
                                clonedObj.setCoords();
                            } else {
                                canvas.add(clonedObj);
                            }
                            
                            // 다음 붙여넣기를 위해 클립보드 객체 자체의 기준점 이동
                            clipboardRef.current.top += 20;
                            clipboardRef.current.left += 20;
                            
                            canvas.setActiveObject(clonedObj);
                            canvas.renderAll();
                        });
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // 붙여넣기 기능 (텍스트 메모장 연동용)
    useEffect(() => {
        const handlePaste = (e) => {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT');
            if (isInputFocused) return;
            
            const canvas = fabricCanvasRef.current;
            if (!canvas) return;

            const activeObject = canvas.getActiveObject();
            if (activeObject && activeObject.isEditing) return;

            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            if (pastedText) {
                e.preventDefault();
                
                const canvasHtmlElement = canvas.getElement();
                const rect = canvasHtmlElement.getBoundingClientRect();
                
                let targetTop = (window.innerHeight / 2) - rect.top;
                if (targetTop < 50) targetTop = 100;
                if (targetTop > canvas.height - 50) targetTop = canvas.height - 100;

                const text = new fabric.Textbox(pastedText, {
                    left: CANVAS_WIDTH / 2,
                    top: targetTop,
                    originX: 'center',
                    originY: 'center',
                    width: CANVAS_WIDTH - 100,
                    splitByGrapheme: true,
                    textAlign: textAlign,
                    fontFamily: fontFamily,
                    fontWeight: fontWeight,
                    fill: textColor,
                    fontSize: 40,
                    transparentCorners: false,
                    cornerColor: '#3498db',
                    cornerStyle: 'circle'
                });

                canvas.add(text);
                canvas.setActiveObject(text);
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [fontFamily, fontWeight, textColor, textAlign]);

    // 레이어 순서 정렬 컨트롤러
    const bringForward = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
            canvas.bringForward(activeObj);
            canvas.discardActiveObject();
            canvas.setActiveObject(activeObj);
        }
    };
    const bringToFront = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
            canvas.bringToFront(activeObj);
            canvas.discardActiveObject();
            canvas.setActiveObject(activeObj);
        }
    };
    const sendBackwards = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
            const objects = canvas.getObjects();
            const idx = objects.indexOf(activeObj);
            if (idx > 0 && objects[idx - 1].evented !== false) {
                canvas.sendBackwards(activeObj);
            }
            canvas.discardActiveObject();
            canvas.setActiveObject(activeObj);
        }
    };
    const sendToBackSafe = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
            const objects = canvas.getObjects();
            const backgroundCount = objects.filter(o => o.evented === false).length;
            canvas.moveTo(activeObj, backgroundCount);
            canvas.discardActiveObject();
            canvas.setActiveObject(activeObj);
        }
    };

    // 이미지 위치를 순서대로 재계산하고 캔버스 높이 업데이트
    const recalculateImagePositions = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        let currentY = 0;
        
        // imageObjectsRef 배열에 있는 순서대로 top 좌표 재설정
        imageObjectsRef.current.forEach((imgObj) => {
            imgObj.set({ top: currentY });
            imgObj.setCoords(); // 좌표계 업데이트
            currentY += (imgObj.height * imgObj.scaleX);
        });

        // 캔버스 사이즈 조절 및 렌더링
        canvas.setHeight(Math.max(currentY, 800));
        canvas.renderAll();
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        let addedImagesInfo = [];

        for (const file of files) {
            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (f) => {
                    fabric.Image.fromURL(f.target.result, (img) => {
                        const scale = CANVAS_WIDTH / img.width;

                        img.set({
                            scaleX: scale,
                            scaleY: scale,
                            left: 0,
                            top: 0, // 임시 위치, recalculate에서 정해짐
                            selectable: false, // 배경 이미지 이동 방지
                            evented: false,
                            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // 고유 ID 부여
                        });

                        canvas.add(img);
                        
                        // 뒷배경으로 깔아주기 (텍스트 등에 안 가려지게)
                        img.sendToBack();
                        
                        imageObjectsRef.current.push(img);
                        addedImagesInfo.push({ id: img.id, name: file.name, src: f.target.result });

                        resolve();
                    });
                };
                reader.readAsDataURL(file);
            });
        }
        
        // 캔버스 상태 업데이트
        recalculateImagePositions();
        
        // UI 상태 업데이트
        setImageList(prev => [...prev, ...addedImagesInfo]);
        
        e.target.value = '';
    };

    const handleAddWhiteLayer = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        // 860x800 사이즈의 백색 이미지 하나를 생성하여 등록
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = CANVAS_WIDTH;
        tempCanvas.height = 800;
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CANVAS_WIDTH, 800);
        
        const whiteDataURL = tempCanvas.toDataURL('image/jpeg');

        fabric.Image.fromURL(whiteDataURL, (img) => {
            img.set({
                scaleX: 1,
                scaleY: 1,
                left: 0,
                top: 0,
                selectable: false,
                evented: false,
                id: `img_white_${Date.now()}`
            });

            canvas.add(img);
            img.sendToBack(); // 배경으로 보내기
            
            imageObjectsRef.current.push(img);
            
            recalculateImagePositions();
            
            setImageList(prev => [...prev, { id: img.id, name: '백색 레이어 (여백)', src: whiteDataURL }]);
        });
    };

    const handleAddText = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        // 현재 화면에서 캔버스가 차지하는 상대적 위치 계산
        const canvasHtmlElement = canvas.getElement();
        const rect = canvasHtmlElement.getBoundingClientRect();
        
        // 현재 화면(Viewport)의 정중앙 Y좌표를 캔버스 내부 Y좌표로 환산
        let targetTop = (window.innerHeight / 2) - rect.top;
        
        // 캔버스 범위를 벗어나는 경우 (혹은 너무 위/아래) 안전장치
        if (targetTop < 50) targetTop = 100;
        if (targetTop > canvas.height - 50) targetTop = canvas.height - 100;

        const text = new fabric.Textbox('여기를 더블클릭해 내용을 입력하세요', {
            left: CANVAS_WIDTH / 2, // 캔버스 가로 중앙
            top: targetTop,         // 환산된 세로 중앙
            originX: 'center',      // 기준점을 객체 중앙으로
            originY: 'center',
            width: CANVAS_WIDTH - 100, // 텍스트 자동 줄바꿈 최대 폭 지정
            splitByGrapheme: true,     // 한글 단어 쪼개기 방지 (문자 단위 줄바꿈)
            textAlign: textAlign,
            fontFamily: fontFamily,
            fontWeight: fontWeight,
            fill: textColor,
            fontSize: 40,
            transparentCorners: false,
            cornerColor: '#3498db',
            cornerStyle: 'circle'
        });

        canvas.add(text);
        canvas.setActiveObject(text);
    };

    const handleFontFamilyChange = (e) => {
        const value = e.target.value;
        setFontFamily(value);
        
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
            activeObj.set('fontFamily', value);
            canvas.renderAll();
        }
    };

    const handleTextAlignChange = (e) => {
        const value = e.target.value;
        setTextAlign(value);
        
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
            activeObj.set('textAlign', value);
            canvas.renderAll();
        }
    };

    const handleFontWeightChange = (e) => {
        const value = e.target.value;
        setFontWeight(value);
        
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
            activeObj.set('fontWeight', value);
            canvas.renderAll();
        }
    };

    const handleTextColorChange = (e) => {
        const value = e.target.value;
        setTextColor(value);

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj.type === 'i-text' || activeObj.type === 'textbox')) {
            activeObj.set('fill', value);
            canvas.renderAll();
        }
    };

    const handleAddRect = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const canvasHtmlElement = canvas.getElement();
        const rect = canvasHtmlElement.getBoundingClientRect();
        
        let targetTop = (window.innerHeight / 2) - rect.top;
        if (targetTop < 50) targetTop = 100;
        if (targetTop > canvas.height - 50) targetTop = canvas.height - 100;

        const shape = new fabric.Rect({
            left: CANVAS_WIDTH / 2,
            top: targetTop,
            originX: 'center',
            originY: 'center',
            fill: shapeColor,
            width: 200,
            height: 150,
            transparentCorners: false,
            cornerColor: '#e74c3c',
            cornerStyle: 'circle'
        });

        canvas.add(shape);
        canvas.setActiveObject(shape);
    };

    const handleShapeColorChange = (e) => {
        const value = e.target.value;
        setShapeColor(value);

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.type === 'rect') {
            activeObj.set('fill', value);
            canvas.renderAll();
        }
    };

    // 이미지 한 칸 위로 올리기
    const moveImageUp = (index) => {
        if (index === 0) return;
        
        // 상태 배열 스왑
        const newList = [...imageList];
        const temp = newList[index];
        newList[index] = newList[index - 1];
        newList[index - 1] = temp;
        setImageList(newList);

        // 실제 fabric 객체 배열 스왑
        const objTemp = imageObjectsRef.current[index];
        imageObjectsRef.current[index] = imageObjectsRef.current[index - 1];
        imageObjectsRef.current[index - 1] = objTemp;

        recalculateImagePositions();
    };

    // 이미지 한 칸 아래로 내리기
    const moveImageDown = (index) => {
        if (index === imageList.length - 1) return;
        
        // 상태 배열 스왑
        const newList = [...imageList];
        const temp = newList[index];
        newList[index] = newList[index + 1];
        newList[index + 1] = temp;
        setImageList(newList);

        // 실제 fabric 객체 배열 스왑
        const objTemp = imageObjectsRef.current[index];
        imageObjectsRef.current[index] = imageObjectsRef.current[index + 1];
        imageObjectsRef.current[index + 1] = objTemp;

        recalculateImagePositions();
    };

    // 특정 이미지 개별 삭제 (보너스 기능)
    const removeImage = (index) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const targetObj = imageObjectsRef.current[index];
        canvas.remove(targetObj);

        // 배열에서 제거
        imageObjectsRef.current.splice(index, 1);
        
        const newList = [...imageList];
        newList.splice(index, 1);
        setImageList(newList);

        recalculateImagePositions();
    };

    // 드래그 앤 드롭 이벤트 핸들러
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // 드래그 시 살짝 투명하게 보이도록 추가 처리 가능
    };

    const handleDragOver = (e, index) => {
        e.preventDefault(); // 기본 이벤트를 막아야 drop 이벤트가 발생함
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        
        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDraggedIndex(null);
            return;
        }

        // 상태 배열 스왑 로직 (Splice 방식)
        const newList = [...imageList];
        const draggedItem = newList[draggedIndex];
        newList.splice(draggedIndex, 1);
        newList.splice(dropIndex, 0, draggedItem);

        setImageList(newList);

        // 실제 Fabric 객체 배열도 동일하게 맞춤
        const draggedObj = imageObjectsRef.current[draggedIndex];
        imageObjectsRef.current.splice(draggedIndex, 1);
        imageObjectsRef.current.splice(dropIndex, 0, draggedObj);

        recalculateImagePositions();
        setDraggedIndex(null);
    };

    // 크롭 모달 열기
    const openCropModal = (index) => {
        const targetImage = imageList[index];
        setCropImageId(targetImage.id);
        setCropImageUrl(targetImage.src);
    };

    // 크롭 완료 처리
    const handleCropComplete = (base64CroppedImage) => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        // 찾아서 이미지 교체
        const targetIndex = imageObjectsRef.current.findIndex(img => img.id === cropImageId);
        if (targetIndex !== -1) {
            const oldImgObj = imageObjectsRef.current[targetIndex];
            
            fabric.Image.fromURL(base64CroppedImage, (newImg) => {
                const scale = CANVAS_WIDTH / newImg.width;
                
                newImg.set({
                    scaleX: scale,
                    scaleY: scale,
                    left: 0,
                    selectable: false,
                    evented: false,
                    id: oldImgObj.id // ID 승계
                });

                // 캔버스 객체 교체
                canvas.remove(oldImgObj);
                canvas.add(newImg);
                newImg.sendToBack(); // 뒤로 깔기

                // 배열 교체
                imageObjectsRef.current[targetIndex] = newImg;
                
                // UI 상태 업데이트
                setImageList(prev => prev.map((item, idx) => 
                    idx === targetIndex ? { ...item, src: base64CroppedImage } : item
                ));

                recalculateImagePositions();
            });
        }

        // 모달 닫기
        setCropImageId(null);
        setCropImageUrl(null);
    };

    // 개별 이미지 JPG 저장
    const exportSingleImage = (index) => {
        const canvas = fabricCanvasRef.current;
        const targetObj = imageObjectsRef.current[index];
        
        if (!canvas || !targetObj) return;

        // 선택 해제 (바운딩 박스가 안보이게)
        canvas.discardActiveObject();
        canvas.renderAll();

        // 캔버스 전체에서 해당 이미지의 영역(좌표/사이즈)만큼만 잘라서 추출
        const dataURL = canvas.toDataURL({
            format: 'jpeg',
            quality: 1.0,
            left: targetObj.left,
            top: targetObj.top,
            width: targetObj.width * targetObj.scaleX,
            height: targetObj.height * targetObj.scaleY,
            multiplier: 1 / targetObj.scaleX // 원래 스케일 무시하고 화질 보존용 배수 설정 (텍스트도 고화질 렌더링)
        });

        const link = document.createElement('a');
        link.download = `개별이미지_${index + 1}_${new Date().getTime()}.jpg`;
        link.href = dataURL;
        link.click();
    };

    const handleExportJpg = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        canvas.discardActiveObject();
        canvas.renderAll();

        const dataURL = canvas.toDataURL({
            format: 'jpeg',
            quality: 1.0,
            multiplier: 1
        });

        const link = document.createElement('a');
        link.download = `상세페이지_${new Date().getTime()}.jpg`;
        link.href = dataURL;
        link.click();
    };

    const handleExportPdf = () => {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        canvas.discardActiveObject();
        canvas.renderAll();

        const finalHeight = fabricCanvasRef.current.height;
        const imgData = canvas.toDataURL({ format: 'jpeg', quality: 1.0 });

        const pdf = new jsPDF({
            orientation: finalHeight > CANVAS_WIDTH ? 'p' : 'l',
            unit: 'px',
            format: [CANVAS_WIDTH, finalHeight]
        });

        pdf.addImage(imgData, 'JPEG', 0, 0, CANVAS_WIDTH, finalHeight);
        pdf.save(`상세페이지_${new Date().getTime()}.pdf`);
    };

    return (
        <div className="flex flex-col items-center bg-[#f5f6f8] min-h-screen font-['Noto_Sans_KR']">
            {/* Toolbar */}
            <div className="sticky top-0 w-full bg-[#2c3e50] py-[10px] flex flex-col items-center gap-3 z-[1000] shadow-[0_4px_6px_rgba(0,0,0,0.1)]">
                {/* 1st Row: Document / Global Controls */}
                <div className="flex justify-center gap-5 w-full">
                    <div className="flex items-center gap-[10px] px-[15px] border-r border-[#4a5d70]">
                        <label className="bg-[#ecf0f1] text-[#2c3e50] px-4 py-2 rounded-[4px] font-bold cursor-pointer hover:bg-[#bdc3c7] transition-colors text-sm">
                            이미지 다중 불러오기
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                            />
                        </label>
                        <button onClick={handleAddWhiteLayer} className="bg-[#ecf0f1] text-[#2c3e50] px-4 py-2 rounded-[4px] font-bold cursor-pointer hover:bg-[#bdc3c7] transition-colors text-sm">
                            백색 레이어 추가
                        </button>
                    </div>

                    <div className="flex items-center gap-[10px] px-[15px] border-r border-[#4a5d70]">
                        <button 
                            onClick={() => setIsMemoOpen(!isMemoOpen)} 
                            className={`px-4 py-2 rounded-[4px] font-bold cursor-pointer transition-colors text-sm ${isMemoOpen ? 'bg-[#3498db] text-white' : 'bg-[#ecf0f1] text-[#2c3e50] hover:bg-[#bdc3c7]'}`}
                        >
                            {isMemoOpen ? '텍스트 닫기' : '텍스트 보기'}
                        </button>
                    </div>

                    <div className="flex items-center gap-[10px] px-[15px]">
                        <button onClick={handleExportJpg} className="bg-[#e74c3c] text-white px-4 py-2 rounded-[4px] font-bold cursor-pointer hover:bg-[#c0392b] transition-colors text-sm">
                            전체 JPG 저장
                        </button>
                        <button onClick={handleExportPdf} className="bg-[#e74c3c] text-white px-4 py-2 rounded-[4px] font-bold cursor-pointer hover:bg-[#c0392b] transition-colors text-sm">
                            전체 PDF 저장
                        </button>
                    </div>
                </div>

                {/* 2nd Row: Object / Local Controls */}
                <div className="flex justify-center gap-5 w-full bg-[#1a252fa6] py-1.5 rounded w-fit px-4">
                    <div className="flex items-center gap-[10px] px-[15px] border-r border-[#4a5d70]">
                        <button onClick={handleAddText} className="bg-[#ecf0f1] text-[#2c3e50] px-3 py-1.5 rounded-[4px] font-bold cursor-pointer hover:bg-[#bdc3c7] transition-colors text-sm">
                            텍스트 추가
                        </button>
                        <select value={fontFamily} onChange={handleFontFamilyChange} className="p-[3px] rounded-[4px] border border-[#ccc] cursor-pointer outline-none w-[120px] text-xs">
                            <option value="Arita-dotum">아리따 돋움 (기본)</option>
                            <option value="Noto Sans KR">노토산스</option>
                            <option value="'Malgun Gothic', '맑은 고딕'">맑은고딕</option>
                            <option value="Gmarket Sans">지마켓 산스</option>
                            <option value="S-CoreDream">에스코어드림</option>
                            <option value="Nanum Gothic">나눔고딕</option>
                            <option value="Black Han Sans">검은고딕 (강조)</option>
                            <option value="Do Hyeon">도현체</option>
                            <option value="Jua">주아체</option>
                            <option value="Gowun Dodum">고운돋움</option>
                            <option value="Nanum Pen Script">나눔펜글씨</option>
                        </select>
                        <select value={textAlign} onChange={handleTextAlignChange} className="p-[3px] rounded-[4px] border border-[#ccc] cursor-pointer outline-none w-[60px] text-xs">
                            <option value="left">좌측</option>
                            <option value="center">중앙</option>
                            <option value="right">우측</option>
                        </select>
                        <select value={fontWeight} onChange={handleFontWeightChange} className="p-[3px] rounded-[4px] border border-[#ccc] cursor-pointer outline-none w-[70px] text-xs">
                            <option value="300">가늘게</option>
                            <option value="normal">보통</option>
                            <option value="bold">두껍게</option>
                            <option value="900">제일두껍</option>
                        </select>
                        <input type="color" value={textColor} onChange={handleTextColorChange} className="p-[2px] rounded border border-[#ccc] cursor-pointer h-[26px] w-[26px] bg-white outline-none" title="텍스트 색상" />
                    </div>

                    <div className="flex items-center gap-[10px] px-[15px] border-r border-[#4a5d70]">
                        <button onClick={handleAddRect} className="bg-[#ecf0f1] text-[#2c3e50] px-3 py-1.5 rounded-[4px] font-bold cursor-pointer hover:bg-[#bdc3c7] transition-colors text-sm">
                            도형(사각) 추가
                        </button>
                        <input type="color" value={shapeColor} onChange={handleShapeColorChange} className="p-[2px] rounded border border-[#ccc] cursor-pointer h-[26px] w-[26px] bg-white outline-none shrink-0" title="도형 색상" />
                    </div>

                    <div className="flex items-center gap-[5px] px-[15px]">
                        <span className="text-white text-xs font-bold mr-1">레이어 순서:</span>
                        <button onClick={bringForward} className="bg-[#bdc3c7] text-[#2c3e50] px-2 py-1 rounded-[4px] font-bold cursor-pointer hover:bg-[#95a5a6] transition-colors text-xs" title="앞으로">
                            ▲
                        </button>
                        <button onClick={bringToFront} className="bg-[#bdc3c7] text-[#2c3e50] px-2 py-1 rounded-[4px] font-bold cursor-pointer hover:bg-[#95a5a6] transition-colors text-xs" title="맨앞으로">
                            ⏫
                        </button>
                        <button onClick={sendBackwards} className="bg-[#bdc3c7] text-[#2c3e50] px-2 py-1 rounded-[4px] font-bold cursor-pointer hover:bg-[#95a5a6] transition-colors text-xs" title="뒤로">
                            ▼
                        </button>
                        <button onClick={sendToBackSafe} className="bg-[#bdc3c7] text-[#2c3e50] px-2 py-1 rounded-[4px] font-bold cursor-pointer hover:bg-[#95a5a6] transition-colors text-xs" title="맨뒤로">
                            ⏬
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-row w-full max-w-[1200px] gap-6 mt-[30px] mb-[50px] px-4 items-start justify-center">
                {/* Editor Area */}
                <div className="shadow-[0_0_20px_rgba(0,0,0,0.15)] bg-white mx-auto order-1">
                    <canvas ref={canvasRef} id="editor-canvas"></canvas>
                </div>

                {/* Right Side Panel: Image Management */}
                {imageList.length > 0 && (
                    <div className="w-[300px] bg-white p-4 rounded-lg shadow-md order-2 sticky top-[100px] shrink-0 border border-gray-200">
                        <h3 className="text-lg font-bold mb-3 border-b pb-2 text-gray-700">이미지 레이어 관리</h3>
                        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
                            {imageList.map((img, index) => (
                                <div 
                                    key={img.id} 
                                    className={`flex flex-col p-2 bg-gray-50 border rounded gap-2 shadow-sm transition-shadow cursor-move ${draggedIndex === index ? 'opacity-50 ring-2 ring-blue-400' : 'hover:shadow'}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={() => setDraggedIndex(null)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-[40px] h-[40px] bg-gray-200 rounded overflow-hidden shrink-0 flex items-center justify-center">
                                            <img src={img.src} alt="thumbnail" className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <span className="text-sm font-medium truncate flex-1" title={img.name}>{img.name}</span>
                                        <div className="flex flex-col gap-1">
                                            <button 
                                                onClick={() => moveImageUp(index)} 
                                                disabled={index === 0}
                                                className="text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:hover:bg-gray-200 px-1 rounded flex-1"
                                                title="순서 위로"
                                            >▲</button>
                                            <button 
                                                onClick={() => moveImageDown(index)} 
                                                disabled={index === imageList.length - 1}
                                                className="text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:hover:bg-gray-200 px-1 rounded flex-1"
                                                title="순서 아래로"
                                            >▼</button>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 mt-1 justify-between">
                                        <button onClick={() => openCropModal(index)} className="flex-1 text-xs py-1 px-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-semibold transition-colors">
                                            ✂️ 크롭
                                        </button>
                                        <button onClick={() => exportSingleImage(index)} className="flex-1 text-xs py-1 px-2 bg-green-100 text-green-700 hover:bg-green-200 rounded font-semibold transition-colors">
                                            💾 개별 저장
                                        </button>
                                        <button onClick={() => removeImage(index)} className="text-xs py-1 px-2 bg-red-100 text-red-700 hover:bg-red-200 rounded font-semibold transition-colors" title="삭제">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* 메모장 패널 */}
            {isMemoOpen && (
                <div 
                    className="fixed z-[2000] bg-white border border-[#ccc] rounded-lg shadow-2xl flex flex-col"
                    style={{ 
                        left: `${memoPosition.x}px`, 
                        top: `${memoPosition.y}px`,
                        width: '350px',
                        minWidth: '250px',
                        minHeight: '200px',
                        resize: 'both',
                        overflow: 'auto'
                    }}
                >
                    <div 
                        className="bg-[#34495e] text-white px-4 py-2 flex justify-between items-center cursor-move rounded-t-lg"
                        onMouseDown={handleMemoMouseDown}
                    >
                        <h3 className="font-bold text-sm select-none">📝 텍스트 저장소 (메모장)</h3>
                        <button onClick={() => setIsMemoOpen(false)} className="text-white hover:text-red-400 font-bold p-1 leading-none">&times;</button>
                    </div>
                    <div className="p-2 flex-grow flex flex-col h-full cursor-auto">
                        <textarea 
                            className="w-full h-full min-h-[150px] p-2 border border-gray-300 rounded resize-none outline-none focus:ring-2 focus:ring-[#3498db] text-sm flex-grow"
                            placeholder="이곳에 복사할 텍스트를 입력해 두고 언제든 꺼내 쓰세요! (내용은 자동 저장됩니다)"
                            value={memoText}
                            onChange={handleMemoChange}
                            spellCheck={false}
                        />
                    </div>
                </div>
            )}

            {cropImageId && cropImageUrl && (
                <ImageCropModal 
                    imageUrl={cropImageUrl} 
                    onCropComplete={handleCropComplete} 
                    onCancel={() => {
                        setCropImageId(null);
                        setCropImageUrl(null);
                    }} 
                />
            )}
        </div>
    );
}
