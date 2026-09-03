import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function mergeValues(base, incoming) {
  if (!incoming || typeof incoming !== "object") {
    return base;
  }

  const output = { ...(base || {}) };
  Object.entries(incoming).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeValues(output[key], value);
      return;
    }

    output[key] = value;
  });

  return output;
}

export function useSettingsSection(section, options = {}) {
  const { pollMs = 0 } = options;
  const [settings, setSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!section) {
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/settings/${section}`, { timeout: 4000 });
      const payload = response.data?.settings || {};
      setSettings(payload);
      setError("");
    } catch {
      setError(`Unable to load ${section} settings from backend.`);
    } finally {
      setIsLoading(false);
    }
  }, [section]);

  const save = useCallback(
    async (updates = {}) => {
      if (!section) {
        return settings;
      }

      setIsSaving(true);
      try {
        const nextSettings = mergeValues(settings, updates);
        const response = await axios.put(
          `${API_BASE_URL}/api/settings/${section}`,
          { settings: nextSettings },
          { timeout: 5000 }
        );
        const payload = response.data?.settings || nextSettings;
        setSettings(payload);
        setError("");
        return payload;
      } catch {
        setError(`Unable to save ${section} settings to backend.`);
        return settings;
      } finally {
        setIsSaving(false);
      }
    },
    [section, settings]
  );

  const reset = useCallback(async () => {
    if (!section) {
      return settings;
    }

    setIsSaving(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/settings/${section}/reset`, {}, { timeout: 5000 });
      const payload = response.data?.settings || {};
      setSettings(payload);
      setError("");
      return payload;
    } catch {
      setError(`Unable to reset ${section} settings from backend.`);
      return settings;
    } finally {
      setIsSaving(false);
    }
  }, [section, settings]);

  const postAction = useCallback(async (path, body = {}) => {
    const response = await axios.post(`${API_BASE_URL}${path}`, body, { timeout: 5000 });
    return response.data || {};
  }, []);

  useEffect(() => {
    setIsLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!pollMs || pollMs < 1000) {
      return undefined;
    }

    const id = window.setInterval(() => {
      refresh();
    }, pollMs);

    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  return useMemo(
    () => ({
      apiBaseUrl: API_BASE_URL,
      settings,
      setSettings,
      isLoading,
      isSaving,
      error,
      refresh,
      save,
      reset,
      postAction
    }),
    [settings, isLoading, isSaving, error, refresh, save, reset, postAction]
  );
}
