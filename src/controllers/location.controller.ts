import { Request, Response } from 'express';
import { INDIAN_STATES_AND_CITIES } from '../constants/locations';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';

export const locationController = {
  /**
   * Get all states and their corresponding cities
   */
  getLocations: asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    // Sort states alphabetically before returning
    const sortedLocations = [...INDIAN_STATES_AND_CITIES].sort((a, b) =>
      a.state.localeCompare(b.state)
    );

    res.status(200).json(new ApiResponse(200, MESSAGES.LOCATIONS_FETCHED, sortedLocations));
  }),
};
