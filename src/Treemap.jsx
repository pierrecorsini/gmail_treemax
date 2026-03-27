import { useMemo, memo, useRef, useEffect, useState, useCallback } from 'react';
import { TreeMap, TreeMapSeries, TreeMapRect } from 'reaviz';
import './Treemap.css';

// Custom label that wraps text to fit in small cells
const CustomTreeMapLabel = ({ data, fontSize = 11, fill = '#FFF' }) => {
  if (!data) return null;
  
  const x0 = Number.isFinite(data.x0) ? data.x0 : 0;
  const x1 = Number.isFinite(data.x1) ? data.x1 : 0;
  const y0 = Number.isFinite(data.y0) ? data.y0 : 0;
  const y1 = Number.isFinite(data.y1) ? data.y1 : 0;
  
  const cellWidth = x1 - x0;
  const cellHeight = y1 - y0;
  const text = data.data?.key || '';
  const count = data.data?.data || 0;
  
  if (!text || cellWidth < 12 || cellHeight < 12) return null;
  
  const padding = 4;
  const lineHeight = fontSize + 3;
  const availableWidth = cellWidth - padding * 2;
  const availableHeight = cellHeight - padding * 2;
  const maxLines = Math.floor(availableHeight / lineHeight);
  
  if (maxLines < 1) return null;
  
  const avgCharWidth = fontSize * 0.5;
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth));
  
  const lines = [];
  let remaining = text;
  
  while (remaining.length > 0 && lines.length < maxLines - 1) {
    if (remaining.length <= charsPerLine) {
      lines.push(remaining);
      break;
    }
    let breakIdx = charsPerLine;
    const spaceIdx = remaining.lastIndexOf(' ', charsPerLine);
    if (spaceIdx > 0) breakIdx = spaceIdx;
    
    lines.push(remaining.slice(0, breakIdx).trim());
    remaining = remaining.slice(breakIdx).trim();
  }
  
  if (lines.length === 0) return null;
  
  const countText = `${count} unread`;
  if (lines.length < maxLines) {
    lines.push(countText);
  }
  
  return (
    <g style={{ transform: `translate(${padding}px, ${padding + fontSize}px)` }}>
      <text
        style={{
          pointerEvents: 'none',
          fontFamily: 'system-ui, sans-serif',
          fontSize: `${fontSize}px`,
          fontWeight: 500,
          fill
        }}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

// Transform data from {id, name, size} to reaviz format {key, data}
const transformData = (data, groupThreshold = 0, groupMode = 'regroup') => {
  if (!data || data.length === 0) return [];

  const validData = data.filter(item => {
    const size = Number(item.size);
    return Number.isFinite(size) && size > 0;
  });

  if (validData.length === 0) return [];

  const sortedData = [...validData].sort((a, b) => b.size - a.size);

  if (groupThreshold <= 0) {
    return sortedData.map((item, index) => ({
      key: item.name || item.id || `item-${index}`,
      data: Math.max(1, Number(item.size) || 1),
      metadata: {
        id: item.id,
        isOthers: false,
        senders: null,
        colorIndex: index
      }
    }));
  }

  const bigSenders = sortedData.filter(item => item.size >= groupThreshold);
  const smallSenders = sortedData.filter(item => item.size < groupThreshold);

  if (groupMode === 'hide') {
    return bigSenders.map((item, index) => ({
      key: item.name || item.id || `item-${index}`,
      data: Math.max(1, Number(item.size) || 1),
      metadata: {
        id: item.id,
        isOthers: false,
        senders: null,
        colorIndex: index
      }
    }));
  }

  if (smallSenders.length === 0) {
    return bigSenders.map((item, index) => ({
      key: item.name || item.id || `item-${index}`,
      data: Math.max(1, Number(item.size) || 1),
      metadata: {
        id: item.id,
        isOthers: false,
        senders: null,
        colorIndex: index
      }
    }));
  }

  const othersTotal = smallSenders.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
  const processedData = [
    ...bigSenders,
    {
      id: '__others__',
      name: `Others (${smallSenders.length} senders)`,
      size: Math.max(1, othersTotal),
      isOthers: true,
      senders: smallSenders
    }
  ];

  return processedData.map((item, index) => ({
    key: item.name || item.id || `item-${index}`,
    data: Math.max(1, Number(item.size) || 1),
    metadata: {
      id: item.id,
      isOthers: item.isOthers || false,
      senders: item.senders,
      colorIndex: index
    }
  }));
};

// Custom tooltip content
const TooltipContent = ({ data }) => {
  if (!data) return null;

  const isOthers = data.metadata?.isOthers;
  const name = data.key;
  const count = data.data;

  return (
    <div className="treemap-tooltip">
      <div className="treemap-tooltip-title">{name}</div>
      <div className="treemap-tooltip-value">
        {isOthers 
          ? `${data.metadata?.senders?.length || 0} senders grouped`
          : `${count} emails`
        }
      </div>
      {!isOthers && (
        <div className="treemap-tooltip-hint">Click to select/deselect</div>
      )}
    </div>
  );
};

function Treemap({ data, groupThreshold = 0, groupMode = 'regroup', selectedTiles, onTileSelect }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const treemapData = useMemo(
    () => transformData(data, groupThreshold, groupMode),
    [data, groupThreshold, groupMode]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let timeout;
    const updateDimensions = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const rect = el.getBoundingClientRect();
        const width = Number.isFinite(rect.width) ? rect.width : 0;
        const height = Number.isFinite(rect.height) ? rect.height : 0;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }, 100);
    };

    requestAnimationFrame(updateDimensions);

    const ro = new ResizeObserver(updateDimensions);
    ro.observe(el);

    return () => { clearTimeout(timeout); ro.disconnect(); };
  }, []);

  // Handle clicks using event delegation on the container
  const handleContainerClick = useCallback((event) => {
    const target = event.target;
    
    // Only handle clicks on rect elements
    if (target.tagName.toLowerCase() !== 'rect') return;
    
    // Find the svg and get all rects to determine the index
    const svg = target.closest('svg');
    if (!svg) return;
    
    const rects = svg.querySelectorAll('rect');
    const rectIndex = Array.from(rects).indexOf(target);
    
    if (rectIndex === -1 || rectIndex >= treemapData.length) return;
    
    const clickedItem = treemapData[rectIndex];
    const email = clickedItem?.metadata?.id;
    const isOthers = clickedItem?.metadata?.isOthers;
    
    if (isOthers || !email) return;
    onTileSelect?.(email);
  }, [treemapData, onTileSelect]);

  // Apply selection highlights after render
  useEffect(() => {
    if (!containerRef.current || !selectedTiles || !treemapData.length) return;

    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    const rects = svg.querySelectorAll('rect');
    
    rects.forEach((rect, index) => {
      if (index < treemapData.length) {
        const item = treemapData[index];
        const email = item?.metadata?.id;
        const isSelected = email && selectedTiles.has(email);
        
        if (isSelected) {
          rect.setAttribute('stroke', '#06b6d4');
          rect.setAttribute('stroke-width', '3');
          rect.style.filter = 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.8))';
        } else {
          rect.removeAttribute('stroke');
          rect.removeAttribute('stroke-width');
          rect.style.filter = '';
        }
      }
    });
  }, [selectedTiles, treemapData, dimensions]);

  const hasData = data && data.length > 0 && treemapData && treemapData.length > 0;
  const safeWidth = Number.isFinite(dimensions.width) ? Math.max(1, dimensions.width) : 0;
  const safeHeight = Number.isFinite(dimensions.height) ? Math.max(1, dimensions.height) : 0;
  const canRender = hasData && safeWidth >= 10 && safeHeight >= 10;

  const selectedCount = useMemo(() => {
    if (!selectedTiles?.size || !treemapData?.length) return 0;
    return treemapData.filter(item => 
      item.metadata?.id && selectedTiles.has(item.metadata.id)
    ).length;
  }, [treemapData, selectedTiles]);

  return (
    <div 
      ref={containerRef} 
      className="treemap-container"
      onClick={handleContainerClick}
    >
      {canRender && (
        <>
          <TreeMap
            width={safeWidth}
            height={safeHeight}
            data={treemapData}
            paddingInner={2}
            paddingOuter={0}
            paddingTop={0}
            series={
              <TreeMapSeries
                colorScheme='unifyviz'
                rect={
                  <TreeMapRect
                    cursor="pointer"
                    tooltip={<TooltipContent />}
                  />
                }
                label={<CustomTreeMapLabel />}
              />
            }
          />
          {selectedCount > 0 && (
            <div className="selection-indicator">
              {selectedCount} tile{selectedCount > 1 ? 's' : ''} selected
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default memo(Treemap);
