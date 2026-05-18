import mongoose from 'mongoose';
import { Library, ILibraryDocument } from '../models/library.model';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { MemberType } from '../constants/enums';
import { memberService, CreateDemoMemberData } from './member.service';

export const scanService = {
  async validateLibraryQr(libraryId: string, qrCodeId: string): Promise<ILibraryDocument> {
    if (!mongoose.Types.ObjectId.isValid(libraryId)) {
      throw new ApiError(400, MESSAGES.INVALID_QR_CODE);
    }

    const library = await Library.findOne({
      _id: libraryId,
      qrCodeId,
      isActive: true,
    });

    if (!library) {
      throw new ApiError(404, MESSAGES.INVALID_QR_CODE);
    }

    return library;
  },

  async getLibraryScanInfo(libraryId: string, qrCodeId: string) {
    const library = await this.validateLibraryQr(libraryId, qrCodeId);

    return {
      libraryId: library._id,
      libraryName: library.libraryName,
      address: library.address,
      qrCodeId: library.qrCodeId,
    };
  },

  async registerDemoStudent(
    libraryId: string,
    qrCodeId: string,
    data: Omit<CreateDemoMemberData, 'memberType'>
  ) {
    await this.validateLibraryQr(libraryId, qrCodeId);

    const member = await memberService.createDemoMember(
      {
        ...data,
        memberType: MemberType.DEMO,
        email: data.email || undefined,
        courseName: data.courseName || undefined,
        remarks: data.remarks || undefined,
      },
      libraryId
    );

    return member;
  },
};
