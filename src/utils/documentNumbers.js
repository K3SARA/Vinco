function getNumberValue(record, fieldName) {
  return record?.[fieldName] || '';
}

async function getCurrentMaxSequence(tx, { modelName, fieldName, prefix, year }) {
  const numberPrefix = `${prefix}${year}-`;
  const latestRecord = await tx[modelName].findFirst({
    where: {
      [fieldName]: {
        startsWith: numberPrefix,
      },
    },
    select: {
      [fieldName]: true,
    },
    orderBy: {
      [fieldName]: 'desc',
    },
  });

  const value = getNumberValue(latestRecord, fieldName);
  const sequenceText = value.slice(numberPrefix.length);
  const sequence = Number.parseInt(sequenceText, 10);
  return Number.isNaN(sequence) ? 0 : sequence;
}

async function ensureCounter(tx, options) {
  const existing = await tx.documentCounter.findUnique({
    where: { name: options.counterName },
  });
  if (existing) return;

  const currentMax = await getCurrentMaxSequence(tx, options);
  try {
    await tx.documentCounter.create({
      data: {
        name: options.counterName,
        value: currentMax,
      },
    });
  } catch (error) {
    if (error.code !== 'P2002') {
      throw error;
    }
  }
}

export async function getNextDocumentNumber(tx, { counterName, prefix, modelName, fieldName, year = new Date().getFullYear() }) {
  const scopedCounterName = `${counterName}:${year}`;
  const options = {
    counterName: scopedCounterName,
    prefix,
    modelName,
    fieldName,
    year,
  };

  await ensureCounter(tx, options);

  const counter = await tx.documentCounter.update({
    where: { name: scopedCounterName },
    data: { value: { increment: 1 } },
  });

  return `${prefix}${year}-${String(counter.value).padStart(4, '0')}`;
}
