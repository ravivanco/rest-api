import { adminService } from '../../admin/service/admin.service';
import { UpdateNutritionistInfoDto } from '../../admin/dto/admin.dto';

export const nutritionistProfileService = {
  async getMyProfile(nutritionistId: number) {
    return adminService.getNutritionistDetail(nutritionistId);
  },

  async updateMyProfile(nutritionistId: number, payload: UpdateNutritionistInfoDto) {
    return adminService.updateNutritionistInfo(nutritionistId, payload);
  },
};
