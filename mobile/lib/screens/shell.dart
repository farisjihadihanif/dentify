import 'package:material_ui/material_ui.dart';

import '../state.dart';
import 'chat.dart';
import 'history.dart';
import 'scan.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  /// Tab dibangun saat pertama dibuka (mis. izin lokasi baru diminta di Clinics).
  final _opened = <int>{};

  static const _pages = <Widget>[
    ScanScreen(),
    HistoryScreen(),
    ChatScreen(),
    Placeholder(),
    Placeholder(),
  ];

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    _opened.add(state.tab);
    return PopScope(
      canPop: state.tab == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) state.openTab(0);
      },
      child: Scaffold(
        body: IndexedStack(
          index: state.tab,
          children: [
            for (var i = 0; i < _pages.length; i++)
              _opened.contains(i) ? _pages[i] : const SizedBox.shrink(),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: state.tab,
          onDestinationSelected: (i) {
            FocusScope.of(context).unfocus();
            state.openTab(i);
          },
          destinations: const [
            NavigationDestination(icon: Icon(Icons.center_focus_strong), label: 'Scan'),
            NavigationDestination(icon: Icon(Icons.history), label: 'History'),
            NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Deni'),
            NavigationDestination(icon: Icon(Icons.location_on_outlined), label: 'Clinics'),
            NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
          ],
        ),
      ),
    );
  }
}
