import { IsString, MaxLength } from 'class-validator';

export class RenameAbaDto {
  @IsString()
  @MaxLength(60)
  from: string;

  @IsString()
  @MaxLength(60)
  to: string;
}

export class DeleteAbaDto {
  @IsString()
  @MaxLength(60)
  name: string;
}

