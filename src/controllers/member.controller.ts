import { Request, Response } from 'express';
import { memberService, MemberSortOption } from '../services/member.service';
import { libraryService } from '../services/library.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { MESSAGES } from '../constants/messages';
import { MemberStatus, MemberType, PaymentStatus } from '../constants/enums';
import { getAuthUserId } from '../utils/auth.util';

const getOwnerLibraryId = async (ownerId: string): Promise<string> => {
  const library = await libraryService.getLibraryByOwner(ownerId);
  return library._id.toString();
};

export const memberController = {
  createMember: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = await getOwnerLibraryId(getAuthUserId(req));
    const member = await memberService.createMember(req.body, libraryId);
    res.status(201).json(new ApiResponse(201, MESSAGES.MEMBER_CREATED, member));
  }),

  getAllMembers: asyncHandler(async (req: Request, res: Response) => {
    const libraryId = await getOwnerLibraryId(getAuthUserId(req));

    const filters = {
      status: req.query.status as MemberStatus | undefined,
      memberType: req.query.memberType as MemberType | undefined,
      paymentStatus: req.query.paymentStatus as PaymentStatus | undefined,
      hasSeat:
        req.query.hasSeat === 'true' ? true : req.query.hasSeat === 'false' ? false : undefined,
      search: req.query.search as string | undefined,
    };

    const pagination = {
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 10,
    };

    const sort = req.query.sort as MemberSortOption | undefined;

    const result = await memberService.getAllMembers(libraryId, filters, pagination, sort);
    res.status(200).json(new ApiResponse(200, MESSAGES.MEMBERS_FETCHED, result));
  }),

  getMemberById: asyncHandler(async (req: Request, res: Response) => {
    const member = await memberService.getMemberById(req.params.id);
    res.status(200).json(new ApiResponse(200, MESSAGES.MEMBER_FETCHED, member));
  }),

  updateMember: asyncHandler(async (req: Request, res: Response) => {
    const member = await memberService.updateMember(req.params.id, req.body);
    res.status(200).json(new ApiResponse(200, MESSAGES.MEMBER_UPDATED, member));
  }),

  deleteMember: asyncHandler(async (req: Request, res: Response) => {
    await memberService.deleteMember(req.params.id);
    res.status(200).json(new ApiResponse(200, MESSAGES.MEMBER_DELETED, null));
  }),
};
