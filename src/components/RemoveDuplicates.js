import React, { useEffect, useState } from "react";
import { db, auth } from "../config/firebase";
import { collection, getDocs, getDoc, query, where, doc, deleteDoc } from "firebase/firestore";
import { Filters } from "./Filters";
import { useFilters } from "../context/FilterContext";
import "../style/table.css";

export const RemoveDuplicates = () => {
  const [loading, setLoading] = useState(false);
  const [controls, setControls] = useState([]);
  const [filteredControls, setFilteredControls] = useState([]);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [selectedControllerId, setSelectedControllerId] = useState("");
  const [controllerIds, setControllerIds] = useState([]);
  const [selectedControlIds, setSelectedControlIds] = useState(new Set());
  const { dateFilter, clubFilter, statusFilter, customStartDate } = useFilters();

  // Fetch controls from ssr_controls collection
  const fetchControls = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      let regionName = "all";
      switch (user.email) {
        case "admin.ompzw@naturai.pl":
          regionName = "Okręg Mazowiecki Polskiego Związku Wędkarskiego w Warszawie";
          break;
        case "admin.tbga@naturai.pl":
          regionName = "Okręg PZW w Tarnobrzegu";
          break;
        default:
          regionName = "all";
          break;
      }

      const snapshot = await getDocs(collection(db, "ssr_controls"));
      const items = await Promise.all(
        snapshot.docs.map(async (document) => {
          const data = document.data();
          const controllerId = data.controller_id ?? null;
          let email = null;
          if (controllerId) {
            try {
              const userDoc = await getDoc(doc(db, "users", controllerId));
              if (userDoc.exists()) {
                email = userDoc.data().email ?? "Brak e-maila";
              }
            } catch (error) {
              console.error(`Błąd pobierania e-maila dla ID: ${controllerId}`, error);
            }
          }
          return {
            id: document.id,
            ...data,
            controller_email: email ? email.split("@")[0] : "Brak e-maila"
          };
        })
      );
      const docs = items.filter(item => item.association_name === regionName);
      
      console.log(`Fetched ${docs.length} controls`);
      setControls(docs);
    } catch (error) {
      console.error("Error fetching controls:", error);
      alert("Błąd podczas pobierania danych: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch controls on component mount
  useEffect(() => {
    fetchControls();
  }, []);

  // Filter controls based on date, club, and status filters
  useEffect(() => {
    filterData();
  }, [dateFilter, clubFilter, statusFilter, controls, customStartDate]);

  const filterData = () => {
    let filtered = controls;

    const now = new Date();
    const currentYear = now.getFullYear();

    filtered = filtered.filter(item => {
      const itemDate = item.control_date ? (item.control_date.toDate ? item.control_date.toDate() : new Date(item.control_date)) : null;
      return itemDate && itemDate.getFullYear() === currentYear;
    });
    
    if (dateFilter !== "previousYear") {
      const now = new Date();
      let cutoffDate;
      let endDate;

      if (dateFilter === "lastWeek") {
        cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - 7);
      } else if (dateFilter === "currentMonth") {
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (dateFilter === "previousMonth") {
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (dateFilter === "currentYear") {
        cutoffDate = new Date(now.getFullYear(), 0, 1);
      } else if (dateFilter === "previousYear") {
        cutoffDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
      } else if (dateFilter === "custom") {
        if (customStartDate) {
          cutoffDate = new Date(customStartDate);
          cutoffDate.setHours(0, 0, 0, 0);
          endDate = new Date(customStartDate);
          endDate.setHours(23, 59, 59, 999);
        }
      }

      if (cutoffDate) {
        filtered = filtered.filter(item => {
          const itemDate = item.control_date ? (item.control_date.toDate ? item.control_date.toDate() : new Date(item.control_date)) : null;
          if (endDate) {
            return itemDate && itemDate >= cutoffDate && itemDate <= endDate;
          }
          return itemDate && itemDate >= cutoffDate;
        });
      }
    } else {
      const now = new Date();
      const cutoffDate = new Date(now.getFullYear() - 1, 0, 1);
      const endDate = new Date(now.getFullYear() - 1, 11, 31);
      filtered = filtered.filter(item => {
        const itemDate = item.control_date ? (item.control_date.toDate ? item.control_date.toDate() : new Date(item.control_date)) : null;
        return itemDate && itemDate >= cutoffDate && itemDate <= endDate;
      });
    }

    if (clubFilter !== "all") {
      filtered = filtered.filter(item => item.association_club_name === clubFilter);
    }
    
    if (statusFilter === "rejected") {
      filtered = filtered.filter(item => !item.is_success);
    }

    setFilteredControls(filtered);
    
    // Extract unique controller IDs from filtered data
    const uniqueControllerIds = [...new Set(filtered.map(doc => doc.controller_id).filter(Boolean))].sort();
    setControllerIds(uniqueControllerIds);
    
    // Find duplicates in filtered data
    findDuplicates(filtered);
  };

  // Find duplicate records based on control_date (rounded to minutes), controller_id, and extractedLicenseNumber
  const findDuplicates = (docs) => {
    const groupMap = {};
    
    // Helper function to round timestamp to nearest minute
    const roundToMinute = (date) => {
      const rounded = new Date(date);
      rounded.setSeconds(0, 0); // Set seconds and milliseconds to 0
      return rounded;
    };
    
    // Log records from Oct 1st and Oct 2nd 2025 for manual verification
    docs.forEach(doc => {
      if (doc.control_date) {
        const date = doc.control_date.toDate ? doc.control_date.toDate() : new Date(doc.control_date);
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-indexed, so October = 9
        const day = date.getDate();
        
        if (year === 2025 && month === 9 && (day === 1 || day === 2)) {
          const roundedDate = roundToMinute(date);
          console.log("Oct 1-2, 2025 control record:", {
            id: doc.id,
            control_date_original: date.toLocaleString('pl-PL'),
            control_date_rounded: roundedDate.toLocaleString('pl-PL'),
            controller_id: doc.controller_id,
            extractedLicenseNumber: doc.extractedLicenseNumber,
            full_object: doc
          });
        }
      }
    });
    
    docs.forEach(doc => {
      if (!doc.control_date || !doc.controller_id) {
        return; // Skip records with missing date or controller_id
      }
      
      // Round timestamp to nearest minute for comparison
      const date = doc.control_date.toDate ? doc.control_date.toDate() : new Date(doc.control_date);
      const roundedDate = roundToMinute(date);
      const dateStr = roundedDate.toISOString();
      
      // Handle null/empty extractedLicenseNumber by using a placeholder
      const licenseNum = doc.extractedLicenseNumber || 'NO_LICENSE';
      
      const key = `${dateStr}_${doc.controller_id}_${licenseNum}`;
      
      if (!groupMap[key]) {
        groupMap[key] = [];
      }
      groupMap[key].push(doc);
    });
    
    // Filter to only groups with duplicates (more than 1 record)
    const duplicates = Object.entries(groupMap)
      .filter(([key, group]) => group.length > 1)
      .map(([key, group]) => ({
        key,
        records: group.sort((a, b) => {
          // Sort by creation time if available, otherwise by document ID
          if (a.control_date && b.control_date) {
            const aDate = a.control_date.toDate ? a.control_date.toDate() : new Date(a.control_date);
            const bDate = b.control_date.toDate ? b.control_date.toDate() : new Date(b.control_date);
            return aDate - bDate;
          }
          return a.id.localeCompare(b.id);
        })
      }));
    
    console.log(`Found ${duplicates.length} duplicate groups`);
    setDuplicateGroups(duplicates);
  };

  // Verify password before allowing deletion
  const verifyPassword = () => {
    const password = prompt("Wprowadź hasło aby usunąć duplikaty:");
    if (password === "deleteIt") {
      setPasswordVerified(true);
      return true;
    } else {
      alert("Nieprawidłowe hasło!");
      return false;
    }
  };

  // Delete duplicate records, keeping only the first one in each group
  const deleteDuplicates = async (group) => {
    if (!passwordVerified && !verifyPassword()) {
      return;
    }
    
    if (!window.confirm(`Czy na pewno chcesz usunąć ${group.records.length - 1} duplikatów z tej grupy?`)) {
      return;
    }
    
    setDeleting(true);
    try {
      // Keep the first record, delete the rest
      const toDelete = group.records.slice(1);
      
      for (const record of toDelete) {
        await deleteDoc(doc(db, "ssr_controls", record.id));
        console.log(`Deleted duplicate: ${record.id}`);
      }
      
      alert(`Usunięto ${toDelete.length} duplikatów`);
      
      // Refresh the list
      await fetchControls();
    } catch (error) {
      console.error("Error deleting duplicates:", error);
      alert("Błąd podczas usuwania duplikatów: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Delete all duplicates from all groups at once
  const deleteAllDuplicates = async () => {
    if (!passwordVerified && !verifyPassword()) {
      return;
    }
    
    const totalToDelete = duplicateGroups.reduce((sum, g) => sum + (g.records.length - 1), 0);
    
    if (!window.confirm(`Czy na pewno chcesz usunąć ${totalToDelete} duplikatów ze wszystkich ${duplicateGroups.length} grup?`)) {
      return;
    }
    
    setDeleting(true);
    try {
      let deletedCount = 0;
      
      // Process each group
      for (const group of duplicateGroups) {
        // Keep the first record, delete the rest
        const toDelete = group.records.slice(1);
        
        for (const record of toDelete) {
          await deleteDoc(doc(db, "ssr_controls", record.id));
          console.log(`Deleted duplicate: ${record.id}`);
          deletedCount++;
        }
      }
      
      alert(`Usunięto ${deletedCount} duplikatów ze wszystkich grup`);
      
      // Refresh the list
      await fetchControls();
    } catch (error) {
      console.error("Error deleting all duplicates:", error);
      alert("Błąd podczas usuwania duplikatów: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Toggle individual control selection
  const toggleControlSelection = (controlId) => {
    setSelectedControlIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(controlId)) {
        newSet.delete(controlId);
      } else {
        newSet.add(controlId);
      }
      return newSet;
    });
  };

  // Toggle all controls for current controller
  const toggleAllControls = () => {
    const currentControls = filteredControls.filter(c => c.controller_id === selectedControllerId);
    const allSelected = currentControls.every(c => selectedControlIds.has(c.id));
    
    setSelectedControlIds(prev => {
      const newSet = new Set(prev);
      currentControls.forEach(control => {
        if (allSelected) {
          newSet.delete(control.id);
        } else {
          newSet.add(control.id);
        }
      });
      return newSet;
    });
  };

  // Delete selected controls
  const deleteSelectedControls = async () => {
    if (selectedControlIds.size === 0) {
      alert("Wybierz kontrole do usunięcia");
      return;
    }

    if (!passwordVerified && !verifyPassword()) {
      return;
    }

    if (!window.confirm(`Czy na pewno chcesz usunąć ${selectedControlIds.size} wybranych kontroli?`)) {
      return;
    }

    setDeleting(true);
    try {
      let deletedCount = 0;
      
      for (const controlId of selectedControlIds) {
        await deleteDoc(doc(db, "ssr_controls", controlId));
        console.log(`Deleted control: ${controlId}`);
        deletedCount++;
      }
      
      alert(`Usunięto ${deletedCount} kontroli`);
      setSelectedControlIds(new Set());
      setSelectedControllerId("");
      
      // Refresh the list
      await fetchControls();
    } catch (error) {
      console.error("Error deleting selected controls:", error);
      alert("Błąd podczas usuwania kontroli: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ marginBottom: '1em' }}>Usuwanie duplikatów kontroli</h2>
      
      <Filters
        data={controls}
        showDownloadButton={false}
        refreshData={fetchControls}
      />
      
      <div style={{ marginBottom: '1.5em', textAlign: 'center', display: 'flex', gap: '1em', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={fetchControls}
          disabled={loading || deleting}
          style={{
            padding: '12px 24px',
            fontSize: '1rem',
            fontWeight: '600',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: (loading || deleting) ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            opacity: (loading || deleting) ? 0.6 : 1
          }}
          onMouseOver={(e) => !(loading || deleting) && (e.target.style.backgroundColor = '#0056b3')}
          onMouseOut={(e) => !(loading || deleting) && (e.target.style.backgroundColor = '#007bff')}
        >
          🔍 Szukaj duplikatów
        </button>
        
        {duplicateGroups.length > 0 && (
          <button
            onClick={deleteAllDuplicates}
            disabled={deleting}
            style={{
              padding: '12px 24px',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: deleting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: deleting ? 0.6 : 1
            }}
            onMouseOver={(e) => !deleting && (e.target.style.backgroundColor = '#c82333')}
            onMouseOut={(e) => !deleting && (e.target.style.backgroundColor = '#dc3545')}
          >
            🗑️ Usuń wszystkie duplikaty
          </button>
        )}
      </div>

      {/* Delete by Controller ID section */}
      {!loading && controls.length > 0 && (
        <div style={{ 
          marginBottom: '2em', 
          padding: '1.5em', 
          backgroundColor: '#fff8e1', 
          borderRadius: '8px',
          border: '1px solid #ffc107'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1em', fontSize: '1.1rem', color: '#856404' }}>
            Usuń kontrole po Kontroler ID
          </h3>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedControllerId}
              onChange={(e) => setSelectedControllerId(e.target.value)}
              disabled={deleting}
              style={{
                padding: '10px 16px',
                fontSize: '1rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: deleting ? 'not-allowed' : 'pointer',
                minWidth: '200px',
                flex: 1
              }}
            >
              <option value="">-- Wybierz Kontroler ID --</option>
              {controllerIds.map(id => {
                const controllerControls = filteredControls.filter(c => c.controller_id === id);
                const count = controllerControls.length;
                const name = controllerControls[0]?.controller_name || 'Nieznany';
                const emailId = controllerControls[0]?.controller_email || 'Brak ID';
                return (
                  <option key={id} value={id}>
                    {name} - {emailId} ({count} kontroli)
                  </option>
                );
              })}
            </select>
            {selectedControllerId && selectedControlIds.size > 0 && (
              <button
                onClick={deleteSelectedControls}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  backgroundColor: '#ff6b6b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  opacity: deleting ? 0.6 : 1
                }}
                onMouseOver={(e) => !deleting && (e.target.style.backgroundColor = '#ff5252')}
                onMouseOut={(e) => !deleting && (e.target.style.backgroundColor = '#ff6b6b')}
              >
                🗑️ Usuń wybrane ({selectedControlIds.size})
              </button>
            )}
          </div>

          {/* Show preview of controls to be deleted */}
          {selectedControllerId && (
            <div style={{ 
              marginTop: '1.5em',
              backgroundColor: '#fff',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                padding: '1em',
                backgroundColor: '#f8f9fa',
                borderBottom: '1px solid #dee2e6',
                fontWeight: '600',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Podgląd kontroli ({filteredControls.filter(c => c.controller_id === selectedControllerId).length} rekordów)</span>
                <button
                  onClick={toggleAllControls}
                  disabled={deleting}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    opacity: deleting ? 0.6 : 1
                  }}
                >
                  {filteredControls.filter(c => c.controller_id === selectedControllerId).every(c => selectedControlIds.has(c.id)) ? '☑ Odznacz wszystkie' : '☐ Zaznacz wszystkie'}
                </button>
              </div>
              <div style={{ 
                maxHeight: '400px',
                overflowY: 'auto',
                overflowX: 'auto'
              }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead style={{ 
                    backgroundColor: '#e9ecef',
                    position: 'sticky',
                    top: 0
                  }}>
                    <tr>
                      <th style={{ 
                        padding: '10px', 
                        textAlign: 'center', 
                        borderBottom: '2px solid #dee2e6',
                        fontWeight: '600',
                        width: '40px'
                      }}>
                        ☐
                      </th>
                      <th style={{ 
                        padding: '10px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #dee2e6',
                        fontWeight: '600'
                      }}>
                        Data kontroli
                      </th>
                      <th style={{ 
                        padding: '10px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #dee2e6',
                        fontWeight: '600'
                      }}>
                        Strażnik
                      </th>
                      <th style={{ 
                        padding: '10px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #dee2e6',
                        fontWeight: '600'
                      }}>
                        Nr licencji
                      </th>
                      <th style={{ 
                        padding: '10px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #dee2e6',
                        fontWeight: '600'
                      }}>
                        Koło
                      </th>
                      <th style={{ 
                        padding: '10px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #dee2e6',
                        fontWeight: '600'
                      }}>
                        Wynik
                      </th>
                      <th style={{ 
                        padding: '10px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #dee2e6',
                        fontWeight: '600'
                      }}>
                        Document ID
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredControls
                      .filter(c => c.controller_id === selectedControllerId)
                      .sort((a, b) => {
                        const aDate = a.control_date?.toDate ? a.control_date.toDate() : new Date(a.control_date);
                        const bDate = b.control_date?.toDate ? b.control_date.toDate() : new Date(b.control_date);
                        return bDate - aDate;
                      })
                      .map((record, index) => (
                        <tr key={record.id} style={{ 
                          borderBottom: '1px solid #dee2e6',
                          backgroundColor: selectedControlIds.has(record.id) ? '#fff3cd' : (index % 2 === 0 ? '#ffffff' : '#f8f9fa')
                        }}>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedControlIds.has(record.id)}
                              onChange={() => toggleControlSelection(record.id)}
                              disabled={deleting}
                              style={{ 
                                cursor: deleting ? 'not-allowed' : 'pointer',
                                width: '16px',
                                height: '16px'
                              }}
                            />
                          </td>
                          <td style={{ padding: '10px', textAlign: 'left' }}>
                            {formatDate(record.control_date)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'left' }}>
                            {record.controller_name || '-'}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>
                            {record.extractedLicenseNumber || '-'}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'left', fontSize: '0.8rem' }}>
                            {record.association_club_name || '-'}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'left' }}>
                            {record.is_success ? (
                              <span style={{ color: '#28a745' }}>✓ OK</span>
                            ) : (
                              <span style={{ color: '#dc3545' }}>✗ Wykroczenia</span>
                            )}
                          </td>
                          <td style={{ 
                            padding: '10px', 
                            textAlign: 'left',
                            fontSize: '0.7rem',
                            color: '#666',
                            fontFamily: 'monospace'
                          }}>
                            {record.id}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2em' }}>
          <div style={{ marginBottom: '1em' }}>Ładowanie danych...</div>
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {duplicateGroups.length > 0 ? (
            <div>
              <div style={{ 
                marginBottom: '1em', 
                padding: '1em', 
                backgroundColor: '#fff3cd', 
                borderRadius: '8px',
                border: '1px solid #ffc107'
              }}>
                <p style={{ margin: 0, fontSize: '1rem', color: '#856404' }}>
                  <strong>Znaleziono {duplicateGroups.length} grup duplikatów</strong>
                  <br />
                  Łącznie {duplicateGroups.reduce((sum, g) => sum + (g.records.length - 1), 0)} rekordów do usunięcia
                </p>
              </div>

              {duplicateGroups.map((group, groupIndex) => (
                <div key={group.key} style={{ 
                  marginBottom: '2em', 
                  padding: '1em', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px',
                  border: '1px solid #dee2e6'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '1em'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>
                      Grupa #{groupIndex + 1} - {group.records.length} rekordów
                    </h3>
                    <button
                      onClick={() => deleteDuplicates(group)}
                      disabled={deleting}
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: deleting ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        opacity: deleting ? 0.6 : 1
                      }}
                      onMouseOver={(e) => !deleting && (e.target.style.backgroundColor = '#c82333')}
                      onMouseOut={(e) => !deleting && (e.target.style.backgroundColor = '#dc3545')}
                    >
                      🗑️ Usuń duplikaty ({group.records.length - 1})
                    </button>
                  </div>

                  <div style={{ 
                    overflowX: 'auto',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    backgroundColor: '#fff'
                  }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      fontSize: '0.875rem'
                    }}>
                      <thead style={{ backgroundColor: '#e9ecef' }}>
                        <tr>
                          <th style={{ 
                            padding: '10px', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #dee2e6',
                            fontWeight: '600'
                          }}>
                            Status
                          </th>
                          <th style={{ 
                            padding: '10px', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #dee2e6',
                            fontWeight: '600'
                          }}>
                            Data kontroli
                          </th>
                          <th style={{ 
                            padding: '10px', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #dee2e6',
                            fontWeight: '600'
                          }}>
                            Kontroler ID
                          </th>
                          <th style={{ 
                            padding: '10px', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #dee2e6',
                            fontWeight: '600'
                          }}>
                            Nr licencji
                          </th>
                          <th style={{ 
                            padding: '10px', 
                            textAlign: 'left', 
                            borderBottom: '2px solid #dee2e6',
                            fontWeight: '600'
                          }}>
                            Document ID
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map((record, index) => (
                          <tr key={record.id} style={{ 
                            borderBottom: '1px solid #dee2e6',
                            backgroundColor: index === 0 ? '#d4edda' : '#ffffff'
                          }}>
                            <td style={{ padding: '10px', textAlign: 'left' }}>
                              {index === 0 ? (
                                <span style={{ 
                                  padding: '4px 8px', 
                                  backgroundColor: '#28a745', 
                                  color: 'white', 
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}>
                                  ZACHOWANY
                                </span>
                              ) : (
                                <span style={{ 
                                  padding: '4px 8px', 
                                  backgroundColor: '#dc3545', 
                                  color: 'white', 
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}>
                                  DO USUNIĘCIA
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'left' }}>
                              {formatDate(record.control_date)}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'left' }}>
                              {record.controller_id || '-'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'left', fontWeight: '600' }}>
                              {record.extractedLicenseNumber || '-'}
                            </td>
                            <td style={{ 
                              padding: '10px', 
                              textAlign: 'left',
                              fontSize: '0.75rem',
                              color: '#666',
                              fontFamily: 'monospace'
                            }}>
                              {record.id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredControls.length > 0 ? (
            <div style={{ 
              padding: '2em', 
              textAlign: 'center',
              color: '#28a745',
              backgroundColor: '#d4edda',
              borderRadius: '8px',
              border: '1px solid #c3e6cb'
            }}>
              <strong>✓ Nie znaleziono duplikatów</strong>
              <br />
              Przeanalizowano {filteredControls.length} rekordów kontroli
            </div>
          ) : (
            <div style={{ 
              padding: '2em', 
              textAlign: 'center',
              color: '#666',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              Kliknij "Szukaj duplikatów" aby rozpocząć skanowanie
            </div>
          )}
        </>
      )}
    </div>
  );
};
