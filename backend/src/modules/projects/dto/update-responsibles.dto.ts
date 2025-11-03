import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

export class UpdateResponsiblesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  responsavelIds: number[];
}
