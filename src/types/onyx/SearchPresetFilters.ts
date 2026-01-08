import type {SearchQueryString} from '@components/Search/types';
import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';

/**
 * Stores filter states for each search preset (Expenses, Reports, Chats).
 * This allows users to navigate between presets while preserving their filter selections.
 */
type SearchPresetFilters = Partial<Record<ValueOf<typeof CONST.SEARCH.SEARCH_KEYS>, SearchQueryString>>;

export default SearchPresetFilters;

