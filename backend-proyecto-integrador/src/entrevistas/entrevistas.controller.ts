import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EntrevistasService } from './entrevistas.service';
import { CreateEntrevistaDto } from './dto/create-entrevista.dto';

@Controller('entrevistas')
@UsePipes(new ValidationPipe({ transform: true }))
export class EntrevistasController {
  constructor(private readonly entrevistasService: EntrevistasService) {}

  @Post()
  async create(@Body() createEntrevistaDto: CreateEntrevistaDto) {
    return this.entrevistasService.create(createEntrevistaDto);
  }

  @Get()
  async findAll() {
    return this.entrevistasService.findAll();
  }

  @Get('estudiante/:idEstudiante')
  async findOneBy(
    @Param('idEstudiante') idEstudiante: string,
  ) {
    return this.entrevistasService.findByEstudiante(idEstudiante);
  }

  @Get('estudiante/:estudianteId/etiqueta/:nombreEtiqueta/textos')
  async getTextosByEstudianteAndEtiqueta(
    @Param('estudianteId') estudianteId: string,
    @Param('nombreEtiqueta') nombreEtiqueta: string,
  ) {
    return this.entrevistasService.getTextosByEstudianteAndEtiqueta(
      estudianteId,
      decodeURIComponent(nombreEtiqueta),
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.entrevistasService.findOne(id);
  }

  @Get(':id/textos')
  async getTextos(@Param('id') id: string) {
    return this.entrevistasService.getTextosByEntrevista(id);
  }

  @Post(':id/textos')
  async addTexto(
    @Param('id') id: string,
    @Body() textoData: { nombre_etiqueta: string; contenido: string; contexto?: string },
  ) {
    return this.entrevistasService.addTexto(id, textoData);
  }
}
