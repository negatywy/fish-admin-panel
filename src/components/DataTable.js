import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

export const DataTable = () => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                console.log("Łączenie z Firestore...");
                const querySnapshot = await getDocs(collection(db, "kontrole"));

                if (querySnapshot.empty) {
                    console.warn("Firestore zwrócił pustą kolekcję.");
                } else {
                    querySnapshot.forEach((doc) => {
                        console.log("Dokument:", doc.id, "Dane:", doc.data());
                    });
                }

                const items = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        data: data.data?.toDate()?.toLocaleString() ?? "Brak daty",
                        kod_grupy: data.kod_grupy ?? "Brak",
                        kolo: data.kolo ?? "Brak",
                        okreg: data.okreg ?? "Brak",
                        powod_odrzucenia: data.powod_odrzucenia ?? "Brak",
                        pozycja: data.pozycja ? `${data.pozycja.latitude}, ${data.pozycja.longitude}` : "Brak pozycji",
                        straznik: data.straznik ?? "Brak",
                        uwagi: data.uwagi ?? "Brak",
                        wynik: data.wynik ?? "Brak",
                        zezwolenie: data.zezwolenie ?? "Brak",
                    };
                });

                console.log("Przetworzone dane:", items);
                setData(items);
            } catch (error) {
                console.error("Błąd pobierania danych:", error);
            }
        };

        fetchData();
    }, []);

    return (
        <div>
            <h2>Lista Danych</h2>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Kod Grupy</th>
                            <th>Koło</th>
                            <th>Okręg</th>
                            <th>Powód Odrzucenia</th>
                            <th>Pozycja</th>
                            <th>Strażnik</th>
                            <th>Uwagi</th>
                            <th>Wynik</th>
                            <th>Zezwolenie</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map(item => (
                            <tr key={item.id}>
                                <td>{item.data}</td>
                                <td>{item.kod_grupy}</td>
                                <td>{item.kolo}</td>
                                <td>{item.okreg}</td>
                                <td>{item.powod_odrzucenia}</td>
                                <td>{item.pozycja}</td>
                                <td>{item.straznik}</td>
                                <td>{item.uwagi}</td>
                                <td>{item.wynik}</td>
                                <td>{item.zezwolenie}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
