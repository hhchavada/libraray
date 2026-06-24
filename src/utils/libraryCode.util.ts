import { Library } from '../models/library.model';

const LIBRARY_CODE_PREFIX = 'BRD-';

export const generateLibraryCode = async (): Promise<string> => {
  const lastLibrary = await Library.findOne({
    libraryCode: { $exists: true, $ne: '' },
  })
    .sort({ libraryCode: -1 })
    .select('libraryCode')
    .lean();

  const lastNumber = lastLibrary?.libraryCode
    ? parseInt(lastLibrary.libraryCode.replace(LIBRARY_CODE_PREFIX, ''), 10)
    : 0;

  const paddedNumber = String(lastNumber + 1).padStart(4, '0');
  return `${LIBRARY_CODE_PREFIX}${paddedNumber}`;
};

/** Assigns BRD-XXXX codes to libraries created before this field existed. */
export const backfillMissingLibraryCodes = async (): Promise<number> => {
  const missing = await Library.find({
    $or: [{ libraryCode: { $exists: false } }, { libraryCode: '' }, { libraryCode: null }],
  })
    .sort({ createdAt: 1 })
    .select('_id')
    .lean();

  let updated = 0;
  for (const lib of missing) {
    const libraryCode = await generateLibraryCode();
    await Library.updateOne({ _id: lib._id }, { $set: { libraryCode } });
    updated += 1;
  }

  return updated;
};

/** Ensures a single library has a BRD-XXXX code (e.g. on read for legacy records). */
export const ensureLibraryCode = async (
  library: { _id: unknown; libraryCode?: string | null }
): Promise<string> => {
  if (library.libraryCode?.trim()) {
    return library.libraryCode.trim().toUpperCase();
  }

  const libraryCode = await generateLibraryCode();
  await Library.updateOne({ _id: library._id }, { $set: { libraryCode } });
  return libraryCode;
};
