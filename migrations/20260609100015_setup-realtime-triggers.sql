-- Add missing columns for frontend compatibility
ALTER TABLE productos_tienda ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE flujo_caja ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE flujo_caja ADD COLUMN IF NOT EXISTS fecha date;
ALTER TABLE reservas_canchas ADD COLUMN IF NOT EXISTS historial text;

-- Create realtime channel patterns
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('canchas', 'Court reservations real-time updates', true)
ON CONFLICT (pattern) DO UPDATE SET enabled = true;

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('billar', 'Billiard history real-time updates', true)
ON CONFLICT (pattern) DO UPDATE SET enabled = true;

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('tienda', 'Store products and categories real-time updates', true)
ON CONFLICT (pattern) DO UPDATE SET enabled = true;

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('flujo', 'Cash flow real-time updates', true)
ON CONFLICT (pattern) DO UPDATE SET enabled = true;

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('presencia', 'Collaborator presence channel', true)
ON CONFLICT (pattern) DO UPDATE SET enabled = true;

-- ========== TRIGGER: reservas_canchas ==========
CREATE OR REPLACE FUNCTION public.notify_canchas()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'canchas',
    'canchas_changed',
    jsonb_build_object(
      'event', TG_OP,
      'id', COALESCE(NEW.id, OLD.id),
      'data', row_to_json(COALESCE(NEW, OLD))::jsonb
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS canchas_trigger ON public.reservas_canchas;
CREATE TRIGGER canchas_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.reservas_canchas
FOR EACH ROW EXECUTE FUNCTION public.notify_canchas();

-- ========== TRIGGER: historial_billar ==========
CREATE OR REPLACE FUNCTION public.notify_billar()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'billar',
    'billar_changed',
    jsonb_build_object(
      'event', TG_OP,
      'id', COALESCE(NEW.id, OLD.id),
      'data', row_to_json(COALESCE(NEW, OLD))::jsonb
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS billar_trigger ON public.historial_billar;
CREATE TRIGGER billar_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.historial_billar
FOR EACH ROW EXECUTE FUNCTION public.notify_billar();

-- ========== TRIGGER: productos_tienda ==========
CREATE OR REPLACE FUNCTION public.notify_tienda_productos()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'tienda',
    'productos_changed',
    jsonb_build_object(
      'event', TG_OP,
      'id', COALESCE(NEW.id, OLD.id),
      'data', row_to_json(COALESCE(NEW, OLD))::jsonb
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tienda_productos_trigger ON public.productos_tienda;
CREATE TRIGGER tienda_productos_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.productos_tienda
FOR EACH ROW EXECUTE FUNCTION public.notify_tienda_productos();

-- ========== TRIGGER: categorias_tienda ==========
CREATE OR REPLACE FUNCTION public.notify_tienda_categorias()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'tienda',
    'categorias_changed',
    jsonb_build_object(
      'event', TG_OP,
      'id', COALESCE(NEW.id, OLD.id),
      'data', row_to_json(COALESCE(NEW, OLD))::jsonb
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tienda_categorias_trigger ON public.categorias_tienda;
CREATE TRIGGER tienda_categorias_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.categorias_tienda
FOR EACH ROW EXECUTE FUNCTION public.notify_tienda_categorias();

-- ========== TRIGGER: flujo_caja ==========
CREATE OR REPLACE FUNCTION public.notify_flujo()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'flujo',
    'flujo_changed',
    jsonb_build_object(
      'event', TG_OP,
      'id', COALESCE(NEW.id, OLD.id),
      'data', row_to_json(COALESCE(NEW, OLD))::jsonb
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS flujo_trigger ON public.flujo_caja;
CREATE TRIGGER flujo_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.flujo_caja
FOR EACH ROW EXECUTE FUNCTION public.notify_flujo();
