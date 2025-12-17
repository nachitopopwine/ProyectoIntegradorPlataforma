import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entrevista } from './entities/entrevista.entity';
import { Etiqueta } from './entities/etiqueta.entity';
import { Texto } from './entities/texto.entity';
import { CreateEntrevistaDto } from './dto/create-entrevista.dto';

@Injectable()
export class EntrevistasService {
  constructor(
    @InjectRepository(Entrevista)
    private entrevistaRepository: Repository<Entrevista>,
    @InjectRepository(Etiqueta)
    private etiquetaRepository: Repository<Etiqueta>,
    @InjectRepository(Texto)
    private textoRepository: Repository<Texto>,
  ) {}

  // MÉTODO PARA CREAR ENTREVISTA
  async create(createEntrevistaDto: CreateEntrevistaDto): Promise<Entrevista> {
    // 1. Verificar que no existe ya esta entrevista para este estudiante
    const existe = await this.entrevistaRepository.findOne({
      where: {
        estudianteId: createEntrevistaDto.id_estudiante.toString(),
        año: createEntrevistaDto.año,
        numero_Entrevista: createEntrevistaDto.numero_entrevista,
      },
    });

    if (existe) {
      throw new BadRequestException(
        `Ya existe la entrevista ${createEntrevistaDto.numero_entrevista} para el año ${createEntrevistaDto.año}`,
      );
    }

    // 2. Crear la nueva entrevista
    const nuevaEntrevista = this.entrevistaRepository.create({
      estudianteId: createEntrevistaDto.id_estudiante.toString(),
      usuarioId: createEntrevistaDto.id_usuario,
      fecha: new Date(createEntrevistaDto.fecha),
      nombre_Tutor: createEntrevistaDto.nombre_tutor,
      año: createEntrevistaDto.año,
      numero_Entrevista: createEntrevistaDto.numero_entrevista,
      duracion_minutos: createEntrevistaDto.duracion_minutos,
      tipo_entrevista: createEntrevistaDto.tipo_entrevista as any,
      estado: createEntrevistaDto.estado as any,
      observaciones: createEntrevistaDto.observaciones,
      temas_abordados: createEntrevistaDto.temas_abordados,
    });

    const entrevistaSaved = await this.entrevistaRepository.save(nuevaEntrevista);

    // 3. Procesar y guardar textos con sus etiquetas
    if (createEntrevistaDto.etiquetas && createEntrevistaDto.etiquetas.length > 0) {
      await this.procesarTextos(
        entrevistaSaved.id,
        createEntrevistaDto.etiquetas,
      );
    }

    // 4. Retornar la entrevista con sus relaciones
    const entrevistaCompleta = await this.entrevistaRepository.findOne({
      where: { id: entrevistaSaved.id },
      relations: ['estudiante', 'usuario', 'textos', 'textos.etiqueta'],
    });

    return entrevistaCompleta!;
  }

  // MÉTODO AUXILIAR: Procesar textos y etiquetas
  private async procesarTextos(
    entrevistaId: string,
    etiquetasDto: any[],
  ): Promise<void> {
    for (const etiquetaDto of etiquetasDto) {
      // Asegurar que la etiqueta existe en la tabla etiquetas
      let etiqueta = await this.etiquetaRepository.findOne({
        where: { nombre_etiqueta: etiquetaDto.nombre_etiqueta },
      });

      if (!etiqueta) {
        // Crear la etiqueta si no existe
        etiqueta = this.etiquetaRepository.create({
          nombre_etiqueta: etiquetaDto.nombre_etiqueta,
        });
        await this.etiquetaRepository.save(etiqueta);
      }

      // Crear los textos asociados
      if (etiquetaDto.textos && etiquetaDto.textos.length > 0) {
        for (const textoDto of etiquetaDto.textos) {
          const texto = this.textoRepository.create({
            entrevistaId: entrevistaId,
            nombre_etiqueta: etiqueta.nombre_etiqueta,
            contenido: textoDto.contenido,
            fecha: new Date(textoDto.fecha),
            contexto: textoDto.contexto,
          });
          await this.textoRepository.save(texto);
        }
      }
    }
  }

  // MÉTODOS CRUD BÁSICOS
  async findAll(): Promise<Entrevista[]> {
    return this.entrevistaRepository.find({
      relations: ['estudiante', 'usuario', 'textos', 'textos.etiqueta'],
      order: { fecha: 'DESC' },
    });
  }

  async findByEstudiante(estudianteId: string): Promise<Entrevista[]> {
    return this.entrevistaRepository.find({
      where: { estudianteId },
      relations: ['estudiante', 'usuario', 'textos', 'textos.etiqueta'],
      order: { fecha: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Entrevista | null> {
    return this.entrevistaRepository.findOne({
      where: { id },
      relations: ['estudiante', 'usuario', 'textos', 'textos.etiqueta'],
    });
  }

  async getTextosByEntrevista(entrevistaId: string): Promise<Texto[]> {
    return this.textoRepository.find({
      where: { entrevistaId },
      relations: ['etiqueta'],
      order: { fecha: 'DESC' },
    });
  }

  // MÉTODO: Obtener todos los textos de un estudiante por etiqueta (historial completo)
  async getTextosByEstudianteAndEtiqueta(
    estudianteId: string,
    nombreEtiqueta: string,
  ): Promise<Texto[]> {
    // Obtener todas las entrevistas del estudiante
    const entrevistas = await this.entrevistaRepository.find({
      where: { estudianteId },
      select: ['id'],
    });

    if (entrevistas.length === 0) {
      return [];
    }

    const entrevistaIds = entrevistas.map((e) => e.id);

    // Obtener todos los textos de esas entrevistas con la etiqueta específica
    return this.textoRepository
      .createQueryBuilder('texto')
      .leftJoinAndSelect('texto.etiqueta', 'etiqueta')
      .leftJoinAndSelect('texto.entrevista', 'entrevista')
      .where('texto.entrevistaId IN (:...entrevistaIds)', { entrevistaIds })
      .andWhere('texto.nombre_etiqueta = :nombreEtiqueta', { nombreEtiqueta })
      .orderBy('texto.fecha', 'DESC')
      .getMany();
  }

  async addTexto(
    entrevistaId: string,
    textoData: { nombre_etiqueta: string; contenido: string; contexto?: string },
  ): Promise<Texto> {
    // Verificar que la entrevista existe
    const entrevista = await this.entrevistaRepository.findOne({
      where: { id: entrevistaId },
    });

    if (!entrevista) {
      throw new BadRequestException('Entrevista no encontrada');
    }

    // Asegurar que la etiqueta existe
    let etiqueta = await this.etiquetaRepository.findOne({
      where: { nombre_etiqueta: textoData.nombre_etiqueta },
    });

    if (!etiqueta) {
      // Crear la etiqueta si no existe
      etiqueta = this.etiquetaRepository.create({
        nombre_etiqueta: textoData.nombre_etiqueta,
      });
      await this.etiquetaRepository.save(etiqueta);
    }

    // Crear el texto
    const texto = this.textoRepository.create({
      entrevistaId: entrevistaId,
      nombre_etiqueta: textoData.nombre_etiqueta,
      contenido: textoData.contenido,
      fecha: new Date(),
      contexto: textoData.contexto,
    });

    return this.textoRepository.save(texto);
  }
}
