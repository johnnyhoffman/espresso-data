/// <reference types='d3' />
/// <reference types='jquery' />

interface UnmodifiedColumnDefinition {
    name: string;
    type: 'numeric' | 'discrete' | 'string' | 'index';
    min?: number;
    max?: number;
    discreteRange?: string[];
}
interface ColumnDefinition extends UnmodifiedColumnDefinition {
    originalIndex: number;
    colorIndex: number;
    isDisabled: boolean;
}
type DataPoint = any[];
interface UnmodifiedData {
    columnCount: number;
    columnDefinitions: UnmodifiedColumnDefinition[];
    values: DataPoint[];
}
interface Data extends UnmodifiedData {
    columnDefinitions: ColumnDefinition[];
}
interface Control {
    definitionOriginalIndex: number;
}
interface RangeControl extends Control {
    min?: number;
    max?: number;
}
interface DisableControl extends Control { }
interface DiscreteControl extends Control {
    discreteValue?: string;
}
interface Controls {
    disable: DisableControl[];
    range: RangeControl[];
    discrete: DiscreteControl[];
    sortOriginalIndex: number;
}

const colors = ['#BF3F3F', '#668999', '#3F3FBF', '#BF7F3F', '#998E66', '#BFBF3F', '#996689', '#7F3FBF', '#7FBF3F', '#BF3FBF', '#669975', '#BF3FBF', '#3FBF3F', '#756699', '996670#', '#3F7FBF', '#06F8AB', '#F7CCAF', '#AFF0F7', '#5B721B'];
const definitionTypes = ['index', 'numeric', 'discrete', 'string'];
const linesHeight = 500;
const blobRowHeight = 12;
const blobRowSeparation = 3;
const linesAndBlobRowsSeparation = 25;
const graphAndKeySeparation = 20;
let fullData: Data;

let clickedDataPoint: DataPoint = null;
let hoveredDataPoint: DataPoint = null;

let clickedOriginalIndexes: number[] = [];
let hoveredOriginalIndex: number = null;

const container = d3.select('body').append('div').classed('container', true);
const svg = container.append('svg').classed('svg-main', true);
const linesG = svg.append('g').classed('lines-group', true);
const blobsG = svg.append('g').classed('blobs-group', true).attr('transform', 'translate(0,' + (linesHeight + linesAndBlobRowsSeparation) + ')');
const hoverG = svg.append('g').classed('hover-group', true);
const key = container.append('div').classed('key', true).style('margin', `${graphAndKeySeparation}px 0 20px 0`);

const controls: Controls = {
    disable: [],
    range: [],
    discrete: [],
    sortOriginalIndex: null
}

const render = (data: Data) => {
    const blobRowCount = data.columnDefinitions.filter(o => (o.type === 'discrete' || o.type === 'string') && !o.isDisabled).length;
    const containerXMargin = 20;
    const containerYMargin = 20;
    const svgWidth = $(window).width() - (2 * containerXMargin);
    const svgHeight =
        linesHeight +
        linesAndBlobRowsSeparation +
        blobRowCount * blobRowHeight +
        (blobRowCount - 1) * blobRowSeparation;

    svg.attr('width', svgWidth).attr('height', svgHeight);
    container.style('margin', d => `${containerYMargin}px ${containerXMargin}px`);

    const lines = linesG.selectAll('.line').data(
        data.columnDefinitions
            .map((o, i) => ({ columnDefinition: o, values: data.values.map(o => o[i]) }))
            .filter(o => o.columnDefinition.type === 'numeric' && !o.columnDefinition.isDisabled)
    );
    lines
        .enter().append('path').classed('line', true)
        .merge(lines)
        .attr('fill', 'none')
        .attr('data-original-index', d => d.columnDefinition.originalIndex)
        .attr('stroke', (d, i) => colors[d.columnDefinition.colorIndex])
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 1.5)
        .attr('d', d => {
            let x = d3.scaleLinear().range([0, svgWidth]);
            let y = d3.scaleLinear().range([linesHeight, 0]);

            x.domain([0, data.values.length - 1]);
            y.domain([
                d.columnDefinition.min === undefined ? d3.min(d.values) : d.columnDefinition.min,
                d.columnDefinition.max === undefined ? d3.max(d.values) : d.columnDefinition.max]);

            return d3.line()
                .defined((d: any) => d || d === 0)
                .curve(d3.curveMonotoneX)
                .x((d, i) => x(i))
                // Are the type definitions for d3 are incorrect here, or am I using it wrong?
                .y(d => y(d as any))(d.values);
        });
    lines.exit().remove();

    const blobRows = blobsG.selectAll('.blob-row').data(
        data.columnDefinitions
            .map((o, i) => ({ columnDefinition: o, values: data.values.map(o => o[i]) }))
            .filter(o => (o.columnDefinition.type === 'discrete' || o.columnDefinition.type === 'string') && !o.columnDefinition.isDisabled)
    );
    blobRows
        .enter().append('g').classed('blob-row', true)
        .merge(blobRows)
        .attr('data-original-index', d => d.columnDefinition.originalIndex)
        .attr('transform', (d, i) => `translate(0,${i * (blobRowHeight + blobRowSeparation)})`)
        .each(function (blobRowData) {
            const isString = blobRowData.columnDefinition.type === 'string';
            const height = isString ? blobRowHeight : (1 / blobRowData.columnDefinition.discreteRange.length) * blobRowHeight;
            const x = d3.scaleLinear().range([0, svgWidth]);
            const width = Math.ceil(svgWidth / (data.values.length - 1)) * 0.66;
            x.domain([0, data.values.length - 1]);

            const blob = d3.select(this).selectAll('.blob').data(blobRowData.values);
            blob
                .enter().append('rect').classed('blob', true)
                .merge(blob)
                .attr('fill', colors[blobRowData.columnDefinition.colorIndex])
                .attr('x', (d, i) => x(i) - width / 2)
                .attr('y', d => isString || !d ? 0 : blobRowData.columnDefinition.discreteRange.map(o => o.toLowerCase()).indexOf(d.toLowerCase()) * height)
                .attr('rx', 3)
                .attr('ry', 3)
                .attr('width', width)
                .attr('height', d => !d ? 0 : height);
            blob.exit().remove();
        });
    blobRows.exit().remove();

    const hoverWidth = Math.ceil(svgWidth / (data.values.length - 1));
    const hoverX = d3.scaleLinear().range([0, svgWidth]);
    hoverX.domain([0, data.values.length - 1])
    const hoverGInner = hoverG.selectAll('.hover-g-inner').data(data.values);
    hoverGInner
        .enter().append('g').classed('hover-g-inner', true).each(function () {
            const element = d3.select(this);
            element.append('rect').classed('hover-rect', true);
            element.append('rect').classed('hover-line', true)
        })
        .merge(hoverGInner)
        .attr('data-index', (d, i) => i)
        .each(function (hoverGData, i) {
            const element = d3.select(this);
            element.selectAll('.hover-rect')
                .attr('x', hoverX(i) - hoverWidth / 2)
                .attr('y', 0)
                .attr('height', svgHeight)
                .attr('width', hoverWidth);
            element.selectAll('.hover-line')
                .attr('x', hoverX(i))
                .attr('y', 0)
                .attr('height', svgHeight)
                .attr('width', 0.5)
        })
        .on('mouseover', function () {
            const element = d3.select(this);
            hoveredDataPoint = data.values[Number(element.attr('data-index'))];
            updateKey();
        })
        .on('mouseout', function () {
            const element = d3.select(this);
            const thisDataPoint = data.values[Number(element.attr('data-index'))];
            hoveredDataPoint = hoveredDataPoint === thisDataPoint ? null : hoveredDataPoint;
            updateKey();
        })
        .on('click', function () {
            const element = d3.select(this);
            const wasSelected = element.classed('hover-g-selected');
            hoverG.selectAll('.hover-g-selected').classed('hover-g-selected', false);
            element.classed('hover-g-selected', !wasSelected);
            clickedDataPoint = wasSelected ? null : data.values[Number(element.attr('data-index'))];
            updateKey();
        });
    hoverGInner.exit().remove();

    const keyRow = key.selectAll('.key-row').data(sortDefinitions(data.columnDefinitions));
    keyRow.enter().append('div').classed('key-row', true)
        .each(function () {
            const element = d3.select(this);
            element.append('div').classed('key-visual-container', true);
            element.append('div').classed('key-name', true);
            element.append('div').classed('key-value', true);
            element.append('div').classed('key-controls', true);
        })
        .merge(keyRow)
        .attr('data-original-index', d => d.originalIndex)
        .on('mouseover', function () {
            const element = d3.select(this);
            hoveredOriginalIndex = Number(element.attr('data-original-index'));
            updateSelectedOrginalIndexes();
        })
        .on('mouseout', function () {
            const element = d3.select(this);
            const thisOriginalIndex = Number(element.attr('data-original-index'));
            hoveredOriginalIndex = hoveredOriginalIndex === thisOriginalIndex ? null : hoveredOriginalIndex;
            updateSelectedOrginalIndexes();
        })
        .each(function (keyData, i) {
            const element = d3.select(this);
            const visualContainer = element.select('.key-visual-container').html('');
            const visual = visualContainer.append('div');
            if (keyData.type === 'numeric') {
                visual.classed('key-line', true).style('border-bottom', `2px solid ${colors[keyData.colorIndex]}`);
            } else if (keyData.type === 'discrete' || keyData.type === 'string') {
                visual.classed('key-block', true).style('background-color', colors[keyData.colorIndex]);
            }
            visualContainer.on('click', function () {
                const element = d3.select(`.key-row[data-original-index="${keyData.originalIndex}"]`);
                const wasSelected = element.classed('key-row-selected');
                element.classed('key-row-selected', !wasSelected);
                const clickedOriginalIndex = Number(element.attr('data-original-index'));
                if (wasSelected) {
                    clickedOriginalIndexes = clickedOriginalIndexes.filter(o => o !== clickedOriginalIndex);
                } else {
                    clickedOriginalIndexes.push(clickedOriginalIndex);
                }
                updateSelectedOrginalIndexes();
            });

            element.select('.key-name').html(keyData.name);

            const keyControls = element.select('.key-controls').html('');
            if (keyData.type === 'index' || keyData.type === 'numeric') {
                const onChange = () => {
                    const getValue = (selector: string) => {
                        const e = element.select(selector);
                        const val = e.property('value');
                        if (!val) return null;
                        const valN = Number(val);
                        e.style('border-color', isNaN(valN) ? 'red' : null);
                        return valN;
                    };
                    const minValue = getValue('.key-control-min');
                    const maxValue = getValue('.key-control-max');
                    if (isNaN(minValue) || isNaN(maxValue)) {
                        clearRangeControl(keyData.originalIndex);
                    } else {
                        addRangeControl({
                            definitionOriginalIndex: keyData.originalIndex,
                            min: minValue,
                            max: maxValue
                        });
                    }
                    render(applyControls());
                }
                const controlValueIntermediate = controls.range.filter(o => o.definitionOriginalIndex === keyData.originalIndex);
                keyControls
                    .append('input')
                    .attr('type', 'number')
                    .classed('key-control-min', true)
                    .property('value', controlValueIntermediate.length && controlValueIntermediate[0].min !== null ? controlValueIntermediate[0].min : '')
                    .on('change', onChange);
                keyControls
                    .append('span')
                    .html(' - ');
                keyControls
                    .append('input')
                    .attr('type', 'number')
                    .classed('key-control-max', true)
                    .property('value', controlValueIntermediate.length && controlValueIntermediate[0].max !== null ? controlValueIntermediate[0].max : '')
                    .on('change', onChange);
            }
            if (keyData.type !== 'index') {
                const controlValueIntermediate = controls.disable.filter(o => o.definitionOriginalIndex === keyData.originalIndex);
                keyControls
                    .append('span').html(' D:');
                keyControls
                    .append('input')
                    .attr('type', 'checkbox')
                    .property('checked', controlValueIntermediate.length ? 'checked' : '')
                    .on('change', function () {
                        if (d3.select(this).property('checked')) {
                            addDisableControl({ definitionOriginalIndex: keyData.originalIndex })
                        } else {
                            clearDisableControl(keyData.originalIndex);
                        }
                        render(applyControls());
                    });
            }
            if (keyData.type === 'numeric') {
                keyControls
                .append('span').html(' S:');
                keyControls
                    .append('input')
                    .attr('type', 'checkbox')
                    .property('checked', controls.sortOriginalIndex === keyData.originalIndex ? 'checked' : '')
                    .on('change', function () {
                        controls.sortOriginalIndex = d3.select(this).property('checked') ? keyData.originalIndex : null;
                        render(applyControls());
                    });
            }
            if (keyData.type === 'discrete') {
                const controlValueIntermediate = controls.discrete.filter(o => o.definitionOriginalIndex === keyData.originalIndex);
                const select = keyControls.append('select');
                const defaultOption = select.append('option').attr('value', '');
                if (!controlValueIntermediate.length) {
                    defaultOption.attr('selected', 'selected');
                }
                keyData.discreteRange.forEach(o => {
                    const option = select.append('option').attr('value', o).html(o);
                    if (controlValueIntermediate.length && controlValueIntermediate[0].discreteValue.toLowerCase() === o.toLowerCase()) {
                        option.attr('selected', 'selected');
                    }
                });
                select.on('change', function () {
                    const value = d3.select(this).property('value');
                    if (value) {
                        addDiscreteControl({ definitionOriginalIndex: keyData.originalIndex, discreteValue: value });
                    } else {
                        clearDiscreteControl(keyData.originalIndex);
                    }
                    render(applyControls());
                });
            }
        });
    keyRow.exit().remove();

    const updateKey = () => {
        const dataPoint = hoveredDataPoint || clickedDataPoint;
        d3.selectAll('.key-row').each(function () {
            const rowElement = d3.select(this);
            const originalIndex = Number(rowElement.attr('data-original-index'));
            const valueElement = rowElement.select('.key-value');
            const actualIndex = getCurrentIndexFromOriginal(data.columnDefinitions, originalIndex);
            valueElement.text(dataPoint && actualIndex !== null ? dataPoint[actualIndex] : "");
        })
    }

    const updateSelectedOrginalIndexes = () => {
        const originalIndexes = clickedOriginalIndexes.concat(hoveredOriginalIndex === null ? [] : [hoveredOriginalIndex]);
        const lines = d3.selectAll('.line, .blob-row');
        lines.each(function () {
            const element = d3.select(this);
            const itemOriginalIndex = Number(element.attr('data-original-index'));
            const shouldHighlight = originalIndexes.indexOf(itemOriginalIndex) >= 0;
            if (element.classed('line')) {
                element.attr('stroke-width', shouldHighlight ? 4 : 1.5);
            } else {
                element.selectAll('.blob-row-hightlight').remove();
                if (shouldHighlight) {
                    element
                        .append('rect')
                        .classed('blob-row-hightlight', true)
                        .attr('height', blobRowHeight)
                        .attr('width', svgWidth)
                        .attr('fill', 'rgba(0,0,0,0.1)');
                }
            }
        })
    };

    updateKey();
    updateSelectedOrginalIndexes();
}

const clearControl = (type: keyof (Controls), definitionOriginalIndex: number) => controls[type] = (controls as any)[type].filter((o: Control) => o.definitionOriginalIndex != definitionOriginalIndex);
const addControl = (type: keyof (Controls), control: Control) => {
    clearControl(type, control.definitionOriginalIndex);
    (controls[type] as any).push(control);
}
const addRangeControl = (control: RangeControl) => addControl('range', control);
const addDisableControl = (control: DisableControl) => addControl('disable', control);
const addDiscreteControl = (control: DiscreteControl) => addControl('discrete', control);
const clearRangeControl = (definitionOriginalIndex: number) => clearControl('range', definitionOriginalIndex);
const clearDisableControl = (definitionOriginalIndex: number) => clearControl('disable', definitionOriginalIndex);
const clearDiscreteControl = (definitionOriginalIndex: number) => clearControl('discrete', definitionOriginalIndex);

const getCurrentIndexFromOriginal = (columnDefinitions: ColumnDefinition[], originalIndex: number) => {
    const actualIndexIntermediate = columnDefinitions.map((o, i) => ({ originalIndex: o.originalIndex, i })).filter(o => o.originalIndex === originalIndex);
    return actualIndexIntermediate.length ? actualIndexIntermediate[0].i : null;
}

// TODO there's got to be a more idiomatic way to deep copy like this
const copyFullData = (): Data => ({
    columnCount: fullData.columnCount,
    columnDefinitions: fullData.columnDefinitions.map(o => ({
        originalIndex: o.originalIndex,
        type: o.type,
        name: o.name,
        max: o.max,
        min: o.min,
        discreteRange: o.discreteRange,
        colorIndex: o.colorIndex,
        isDisabled: o.isDisabled
    })),
    values: fullData.values.map(o => o.map(p => p))
});

const applyControls = (): Data => {
    const data = copyFullData();
    controls.range.forEach(control => {
        const i = getCurrentIndexFromOriginal(data.columnDefinitions, control.definitionOriginalIndex);
        data.values = data.values.filter(o => !(control.min !== null && o[i] < control.min || control.max !== null && o[i] > control.max));
    });
    controls.disable.forEach(control => {
        data.columnDefinitions.filter(o => o.originalIndex === control.definitionOriginalIndex)[0].isDisabled = true;
    });
    controls.discrete.forEach(control => {
        const i = getCurrentIndexFromOriginal(data.columnDefinitions, control.definitionOriginalIndex);
        data.values = data.values.filter(o => o[i] && o[i].toLowerCase() === control.discreteValue.toLowerCase());
    });
    if (controls.sortOriginalIndex != null) {
        const i1 = getCurrentIndexFromOriginal(data.columnDefinitions, controls.sortOriginalIndex);
        const i2 = data.columnDefinitions.map((o, i) => ({ o: o, i: i })).filter(o => o.o.type === 'index')[0].i;
        data.values = data.values
            .filter(o => o[i1] || o[i1] === 0)
            .sort((a, b) => a[i1] > b[i1] ? 1 : a[i1] < b[i1] ? -1 : a[i2] > b[i2] ? 1 : a[i2] < b[i2] ? -1 : 0);
    }
    return data;
}

const sortDefinitions = (definitions: ColumnDefinition[]): ColumnDefinition[] => definitions
    .map((d, i) => ({ i, d }))
    .sort((a, b) => {
        let comparison = definitionTypes.indexOf(a.d.type.toLowerCase()) - definitionTypes.indexOf(b.d.type.toLowerCase());
        comparison = comparison !== 0 ? comparison : a.i - b.i;
        return comparison;
    })
    .map(d => d.d);

const modifyData = (unmodified: UnmodifiedData): Data => {
    unmodified.columnDefinitions.unshift({
        name: "Index",
        type: 'index'
    });
    let lineIndex = 0;
    let blobIndex = 0;
    return {
        columnCount: unmodified.columnCount,
        values: unmodified.values.map((o, i) => { o.unshift(i); return o; }),
        columnDefinitions: unmodified.columnDefinitions.map((o, i) => ({
            name: o.name,
            type: o.type,
            min: o.min,
            max: o.max,
            discreteRange: o.discreteRange,
            originalIndex: i,
            colorIndex: o.type === 'numeric' ? lineIndex++ : o.type === 'string' || o.type === 'discrete' ? blobIndex++ : 0,
            isDisabled: false
        }))
    };
};

$.getJSON('/data.json', (data: UnmodifiedData) => {
    fullData = modifyData(data);
    render(fullData);
    window.addEventListener("resize", () => render(applyControls()));
});