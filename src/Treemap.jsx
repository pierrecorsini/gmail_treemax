import { useMemo, memo, useRef, useEffect, useState } from 'react';
import { TreeMap, TreeMapSeries, TreeMapRect } from 'reaviz';
import './Treemap.css';

// Custom label that wraps text to fit in small cells
const CustomTreeMapLabel = ({ data, fontSize = 11, fill = '#FFF' }) => {
  if (!data) return null;
  
  // Guard against NaN values in coordinates
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
  
  // Estimate chars per line (monospace approximation)
  const avgCharWidth = fontSize * 0.5;
  const charsPerLine = Math.max(1, Math.floor(availableWidth / avgCharWidth));
  
  // Build wrapped lines
  const lines = [];
  let remaining = text;
  
  while (remaining.length > 0 && lines.length < maxLines - 1) {
    if (remaining.length <= charsPerLine) {
      lines.push(remaining);
      break;
    }
    // Find break point (prefer space)
    let breakIdx = charsPerLine;
    const spaceIdx = remaining.lastIndexOf(' ', charsPerLine);
    if (spaceIdx > 0) breakIdx = spaceIdx;
    
    lines.push(remaining.slice(0, breakIdx).trim());
    remaining = remaining.slice(breakIdx).trim();
  }
  
  if (lines.length === 0) return null;
  
  // Add count line if space allows
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
// groupThreshold: minimum email count to show separately (senders with < threshold are grouped/hidden)
// groupMode: 'regroup' to combine into "Others", 'hide' to remove completely
const transformData = (data, groupThreshold = 0, groupMode = 'regroup') => {
  console.log('[Treemap] transformData called:', { 
    dataLength: data?.length, 
    groupThreshold, 
    groupMode,
    firstItem: data?.[0]
  });
  
  if (!data || data.length === 0) {
    console.log('[Treemap] transformData: no data, returning []');
    return [];
  }

  // Filter out items with invalid size values and ensure positive numbers
  const validData = data.filter(item => {
    const size = Number(item.size);
    const valid = Number.isFinite(size) && size > 0;
    if (!valid) {
      console.log('[Treemap] Invalid item filtered out:', item);
    }
    return valid;
  });

  console.log('[Treemap] transformData validData count:', validData.length);

  if (validData.length === 0) {
    console.log('[Treemap] transformData: no valid data, returning []');
    return [];
  }

  const sortedData = [...validData].sort((a, b) => b.size - a.size);

  // If no threshold, return all data
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

  // Separate senders by threshold (senders with size < threshold are "small")
  const bigSenders = sortedData.filter(item => item.size >= groupThreshold);
  const smallSenders = sortedData.filter(item => item.size < groupThreshold);

  // If hide mode, just return big senders
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

  // Regroup mode: combine small senders into "Others"
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
    </div>
  );
};

function Treemap({ data, groupThreshold = 0, groupMode = 'regroup' }) {
  console.log('[Treemap] Component rendering with props:', { 
    dataLength: data?.length, 
    firstDataItem: data?.[0],
    groupThreshold, 
    groupMode 
  });
  
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    console.log('[Treemap] useEffect - container element:', el);
    if (!el) return;

    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      const width = Number.isFinite(rect.width) ? rect.width : 0;
      const height = Number.isFinite(rect.height) ? rect.height : 0;
      console.log('[Treemap] updateDimensions:', { width, height });
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    };

    const rafId = requestAnimationFrame(updateDimensions);

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) {
        console.log('[Treemap] ResizeObserver: no rect');
        return;
      }
      const width = Number.isFinite(rect.width) ? rect.width : 0;
      const height = Number.isFinite(rect.height) ? rect.height : 0;
      console.log('[Treemap] ResizeObserver:', { width, height });
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const treemapData = useMemo(
    () => transformData(data, groupThreshold, groupMode),
    [data, groupThreshold, groupMode]
  );

  console.log('[Treemap] After transform:', { 
    treemapDataLength: treemapData?.length,
    firstTreemapItem: treemapData?.[0],
    dimensions 
  });

  const hasData = data && data.length > 0 && treemapData && treemapData.length > 0;
  const safeWidth = Number.isFinite(dimensions.width) ? Math.max(1, dimensions.width) : 0;
  const safeHeight = Number.isFinite(dimensions.height) ? Math.max(1, dimensions.height) : 0;
  const canRender = hasData && safeWidth >= 10 && safeHeight >= 10;

  console.log('[Treemap] Render check:', { hasData, safeWidth, safeHeight, canRender });

  return (
    <div ref={containerRef} className="treemap-container">
      {canRender && (
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
      )}
    </div>
  );
}

export default memo(Treemap);
