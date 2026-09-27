function normalizeText(value) {
  return String(value ?? '').trim();
}

function isEmptyValue(value) {
  return value === null || value === undefined || normalizeText(value) === '';
}

function toLowerCaseText(value) {
  return normalizeText(value).toLocaleLowerCase('fi');
}

export function parseFinnishNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  const normalized = normalizeText(value).replace(/\s+/g, '').replace(',', '.');
  if (!normalized) {
    return Number.NaN;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseDateValue(value) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.NaN;
  }

  const normalized = normalizeText(value);
  if (!normalized) {
    return Number.NaN;
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function compareValues(leftValue, rightValue, type) {
  if (type === 'number') {
    return parseFinnishNumber(leftValue) - parseFinnishNumber(rightValue);
  }

  if (type === 'date') {
    return parseDateValue(leftValue) - parseDateValue(rightValue);
  }

  return toLowerCaseText(leftValue).localeCompare(toLowerCaseText(rightValue), 'fi', { numeric: true, sensitivity: 'base' });
}

function normalizeDirection(direction, defaultDirection = 'asc') {
  if (direction === 'asc' || direction === 'desc') {
    return direction;
  }

  return defaultDirection === 'desc' ? 'desc' : 'asc';
}

export function toggleSortState(currentSort, field, defaultDirection = 'asc') {
  const nextDirection = normalizeDirection(defaultDirection);
  if (!field) {
    return { field: '', direction: nextDirection };
  }

  if (currentSort?.field !== field) {
    return { field, direction: nextDirection };
  }

  return {
    field,
    direction: currentSort.direction === 'asc' ? 'desc' : 'asc',
  };
}

export function sortTableRows(rows, sortState, columnConfig = {}) {
  if (!Array.isArray(rows) || rows.length <= 1 || !sortState?.field) {
    return [...(rows || [])];
  }

  const direction = normalizeDirection(sortState.direction);
  const config = columnConfig[sortState.field] || {};
  const type = config.type || 'text';

  return rows
    .map((row, index) => ({ row, index }))
    .sort((leftEntry, rightEntry) => {
      const leftValue = typeof config.getValue === 'function' ? config.getValue(leftEntry.row) : leftEntry.row?.[sortState.field];
      const rightValue = typeof config.getValue === 'function' ? config.getValue(rightEntry.row) : rightEntry.row?.[sortState.field];
      const leftEmpty = isEmptyValue(leftValue);
      const rightEmpty = isEmptyValue(rightValue);

      if (leftEmpty && rightEmpty) {
        return leftEntry.index - rightEntry.index;
      }

      if (leftEmpty) {
        return 1;
      }

      if (rightEmpty) {
        return -1;
      }

      const comparison = compareValues(leftValue, rightValue, type);
      if (comparison !== 0) {
        return direction === 'desc' ? comparison * -1 : comparison;
      }

      return leftEntry.index - rightEntry.index;
    })
    .map((entry) => entry.row);
}
